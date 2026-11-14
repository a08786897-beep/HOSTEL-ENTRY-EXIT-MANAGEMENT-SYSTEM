require('dotenv').config();

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/StudentLogin');
const GatePass = require('../src/models/GatePass');
const Notification = require('../src/models/Notification');

const canRun = Boolean(process.env.MONGO_URI && process.env.JWT_SECRET);

test('authenticated hostel gate pass workflow and role restrictions', { skip: !canRun }, async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prefix = `workflow-${suffix}`;
    const users = [];
    let server;

    try {
        await mongoose.connect(process.env.MONGO_URI);
        await Promise.all([User.init(), GatePass.init(), Notification.init()]);
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        const allowedOrigin = await fetch(`${baseUrl}/health`, {
            headers: { Origin: 'http://127.0.0.1:5500' }
        });
        assert.equal(allowedOrigin.status, 200);
        const rejectedOrigin = await fetch(`${baseUrl}/health`, {
            headers: { Origin: 'https://untrusted.example' }
        });
        assert.equal(rejectedOrigin.status, 403);
        const call = async (path, { token, ...options } = {}) => {
            const headers = new Headers(options.headers || {});
            if (options.body) headers.set('Content-Type', 'application/json');
            if (token) headers.set('Authorization', `Bearer ${token}`);
            const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
            return { status: response.status, body: await response.json() };
        };
        const register = await call('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: `${prefix}-student`, email: `${prefix}@example.test`, password: 'TestPass123!' })
        });
        assert.equal(register.status, 201);
        const studentToken = register.body.token;
        const studentId = register.body.user._id;
        users.push(studentId);

        assert.equal((await call('/health')).status, 200);
        assert.equal((await call('/auth/me', { token: studentToken })).body.user.role, 'Student');
        assert.equal(Object.prototype.hasOwnProperty.call(register.body.user, 'password'), false);
        const storedStudent = await User.findById(studentId).select('+password');
        assert.notEqual(storedStudent.password, 'TestPass123!');
        assert.match(storedStudent.password, /^\$2/);
        assert.equal((await call('/auth/me')).status, 401);
        assert.equal((await call('/profile', { token: studentToken })).status, 200);
        assert.equal((await call('/profile', {
            method: 'PATCH',
            token: studentToken,
            body: JSON.stringify({ rollNumber: 'TEST-001', room: 'T-01', role: 'Admin' })
        })).status, 200);
        assert.equal((await User.findById(studentId)).role, 'Student');
        assert.equal((await call('/students', { token: studentToken })).status, 403);
        assert.equal((await call('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: `${prefix}-bad`, email: 'invalid', password: 'short' })
        })).status, 400);
        assert.equal((await call('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username: `${prefix}-student`, email: `${prefix}@example.test`, password: 'TestPass123!' })
        })).status, 409);

        const staffPassword = await bcrypt.hash('TestPass123!', 10);
        const [warden, guard, admin] = await User.create([
            { username: `${prefix}-warden`, email: `${prefix}-warden@example.test`, password: staffPassword, role: 'Warden' },
            { username: `${prefix}-guard`, email: `${prefix}-guard@example.test`, password: staffPassword, role: 'SecurityGuard' },
            { username: `${prefix}-admin`, email: `${prefix}-admin@example.test`, password: staffPassword, role: 'Admin' }
        ]);
        users.push(warden._id, guard._id, admin._id);
        const login = await call('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier: warden.email, password: 'TestPass123!' })
        });
        assert.equal(login.status, 200);
        assert.equal((await call('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier: warden.email, password: 'incorrect' })
        })).status, 401);
        const wardenToken = login.body.token;
        const guardToken = (await call('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier: guard.email, password: 'TestPass123!' })
        })).body.token;
        const adminToken = (await call('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier: admin.email, password: 'TestPass123!' })
        })).body.token;

        const toLocalParts = (value) => ({
            date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
            time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        });
        const exitWindow = toLocalParts(new Date(Date.now() + 5 * 60000));
        const returnWindow = toLocalParts(new Date(Date.now() + 60 * 60000));
        const passPayload = {
            passType: 'Medical',
            destination: 'Test clinic',
            exitDate: exitWindow.date,
            exitTime: exitWindow.time,
            returnDate: returnWindow.date,
            returnTime: returnWindow.time,
            parentContact: '+15551234567',
            reason: 'Automated integration workflow'
        };
        assert.equal((await call('/gate-passes', { method: 'POST', token: studentToken, body: JSON.stringify({}) })).status, 400);
        const submitted = await call('/gate-passes', {
            method: 'POST',
            token: studentToken,
            body: JSON.stringify(passPayload)
        });
        assert.equal(submitted.status, 201);
        const passId = submitted.body.gatePass._id;
        assert.ok(await GatePass.exists({ _id: passId, student: studentId, status: 'Pending' }));
        assert.equal((await call(`/gate-passes/${passId}`, { token: studentToken })).status, 200);
        assert.equal((await call(`/gate-passes/${passId}/qr`, { token: studentToken })).status, 409);
        assert.equal((await call('/gate-passes', { token: studentToken })).body.gatePasses.length, 1);
        assert.equal((await call('/gate-passes', {
            method: 'POST',
            token: studentToken,
            body: JSON.stringify(passPayload)
        })).status, 409);
        assert.equal((await call('/gate-passes/not-an-id', { token: studentToken })).status, 400);
        assert.equal((await call(`/gate-passes/${passId}/review`, {
            method: 'PATCH',
            token: studentToken,
            body: JSON.stringify({ status: 'Approved' })
        })).status, 403);
        assert.equal((await call(`/gate-passes/${passId}/review`, {
            method: 'PATCH',
            token: wardenToken,
            body: JSON.stringify({ status: 'Rejected' })
        })).status, 400);
        assert.equal((await call(`/gate-passes/${passId}/movement`, {
            method: 'PATCH',
            token: guardToken,
            body: JSON.stringify({ action: 'exit' })
        })).status, 409);

        const approved = await call(`/gate-passes/${passId}/review`, {
            method: 'PATCH',
            token: wardenToken,
            body: JSON.stringify({ status: 'Approved' })
        });
        assert.equal(approved.status, 200);
        assert.equal((await GatePass.findById(passId)).status, 'Approved');
        const qr = await call(`/gate-passes/${passId}/qr`, { token: studentToken });
        assert.equal(qr.status, 200);
        assert.match(qr.body.qrCode, /^data:image\/png;base64,/);
        assert.equal((await call(`/gate-passes/${passId}`, {
            method: 'DELETE',
            token: studentToken
        })).status, 409);
        assert.equal((await call(`/gate-passes/${passId}/review`, {
            method: 'PATCH',
            token: wardenToken,
            body: JSON.stringify({ status: 'Rejected', rejectionReason: 'duplicate decision' })
        })).status, 409);

        assert.equal((await call(`/gate-passes/${passId}/movement`, {
            method: 'PATCH',
            token: guardToken,
            body: JSON.stringify({ action: 'exit' })
        })).status, 409);
        await GatePass.updateOne({ _id: passId }, {
            $set: { exitAt: new Date(Date.now() - 1000), returnAt: new Date(Date.now() + 3600000) }
        });
        assert.equal((await call(`/gate-passes/${passId}/movement`, {
            method: 'PATCH',
            token: guardToken,
            body: JSON.stringify({ action: 'exit' })
        })).status, 200);
        assert.ok((await GatePass.findById(passId)).exitedAt);
        assert.equal((await call(`/gate-passes/${passId}/movement`, {
            method: 'PATCH',
            token: guardToken,
            body: JSON.stringify({ action: 'exit' })
        })).status, 409);
        assert.equal((await call(`/gate-passes/${passId}/movement`, {
            method: 'PATCH',
            token: guardToken,
            body: JSON.stringify({ action: 'entry' })
        })).status, 200);
        assert.ok((await GatePass.findById(passId)).enteredAt);

        const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000);
        const secondDate = `${dayAfterTomorrow.getFullYear()}-${String(dayAfterTomorrow.getMonth() + 1).padStart(2, '0')}-${String(dayAfterTomorrow.getDate()).padStart(2, '0')}`;
        const secondPassPayload = { ...passPayload, exitDate: secondDate, returnDate: secondDate };
        const secondPass = await call('/gate-passes', {
            method: 'POST',
            token: studentToken,
            body: JSON.stringify(secondPassPayload)
        });
        assert.equal(secondPass.status, 201);
        const rejected = await call(`/gate-passes/${secondPass.body.gatePass._id}/review`, {
            method: 'PATCH',
            token: adminToken,
            body: JSON.stringify({ status: 'Rejected', rejectionReason: 'Please provide additional details.' })
        });
        assert.equal(rejected.status, 200);
        assert.equal((await GatePass.findById(secondPass.body.gatePass._id)).rejectionReason, 'Please provide additional details.');
        assert.equal((await call(`/gate-passes/${secondPass.body.gatePass._id}/movement`, {
            method: 'PATCH',
            token: guardToken,
            body: JSON.stringify({ action: 'exit' })
        })).status, 409);

        assert.equal((await call('/students', { token: wardenToken })).status, 200);
        assert.equal((await call('/admin/users', { token: wardenToken })).status, 403);
        assert.equal((await call('/admin/users', { token: adminToken })).status, 200);
        assert.equal((await call(`/admin/users/${studentId}/role`, {
            method: 'PATCH',
            token: adminToken,
            body: JSON.stringify({ role: 'Warden' })
        })).status, 200);
        assert.equal((await User.findById(studentId)).role, 'Warden');
        assert.equal((await call(`/admin/users/${admin._id}/role`, {
            method: 'PATCH',
            token: adminToken,
            body: JSON.stringify({ role: 'Student' })
        })).status, 400);
        await User.findByIdAndUpdate(studentId, { $set: { role: 'Student' } });
        assert.equal((await call('/reports', { token: guardToken })).status, 403);
        assert.equal((await call('/reports', { token: adminToken })).status, 200);
        assert.equal((await call('/movements', { token: studentToken })).body.movements.length, 1);
        const notifications = (await call('/notifications', { token: studentToken })).body.notifications;
        assert.equal(notifications.length, 6);
        assert.equal((await call(`/notifications/${notifications[0]._id}/read`, {
            method: 'PATCH',
            token: studentToken
        })).status, 200);
        assert.equal((await call('/dashboard/stats', { token: studentToken })).body.stats.total, 2);
        const cancelPayload = {
            ...passPayload,
            exitDate: secondDate,
            returnDate: secondDate,
            exitTime: '09:00',
            returnTime: '18:00'
        };
        const cancellable = await call('/gate-passes', {
            method: 'POST',
            token: studentToken,
            body: JSON.stringify(cancelPayload)
        });
        assert.equal(cancellable.status, 201);
        assert.equal((await call(`/gate-passes/${cancellable.body.gatePass._id}`, {
            method: 'DELETE',
            token: studentToken
        })).status, 200);
        assert.equal(await GatePass.exists({ _id: cancellable.body.gatePass._id }), null);
        assert.equal((await call('/auth/logout', { method: 'POST', token: studentToken })).status, 200);
        assert.equal((await call('/auth/me', { token: studentToken })).status, 401);
    } finally {
        if (users.length) {
            await Notification.deleteMany({ user: { $in: users } });
            await GatePass.deleteMany({ student: { $in: users } });
            await User.deleteMany({ _id: { $in: users } });
        }
        if (server) await new Promise((resolve) => server.close(resolve));
        if (mongoose.connection.readyState) await mongoose.disconnect();
    }
});
