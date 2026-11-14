const escapeHtml = HEMS.escapeHtml;
const page = document.body.dataset.page;

function showNotice(message, type = 'info') {
    const notice = document.querySelector('#pageNotice');
    if (notice && message) HEMS.showMessage(notice, message, type);
}

function formatDate(value) {
    return value ? new Date(value).toLocaleString() : '—';
}

function statusBadge(status) {
    const type = status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning text-dark';
    return `<span class="badge bg-${type}">${escapeHtml(status || 'Pending')}</span>`;
}

function passLink(id, label = 'View') {
    return `<a class="btn btn-sm btn-outline-primary" href="view-pass.html?id=${encodeURIComponent(id)}">${label}</a>`;
}

function displayUser(user) {
    document.querySelectorAll('[data-user-name]').forEach((element) => {
        element.textContent = user.username;
    });
    document.querySelectorAll('[data-user-role]').forEach((element) => {
        element.textContent = user.role;
    });
    document.querySelectorAll('[data-roles]').forEach((element) => {
        const roles = element.dataset.roles.split(',').map((role) => role.trim());
        element.hidden = !roles.includes(user.role);
    });
    showNotice(sessionStorage.getItem('hemsNotice'));
    sessionStorage.removeItem('hemsNotice');
}

async function loadDashboard(user) {
    const [{ stats }, { gatePasses }, { notifications }] = await Promise.all([
        HEMS.request('/dashboard/stats'),
        HEMS.request('/gate-passes'),
        HEMS.request('/notifications')
    ]);
    const values = {
        totalPasses: stats.total,
        pendingPasses: stats.pending,
        approvedPasses: stats.approved,
        rejectedPasses: stats.rejected,
        exitsToday: stats.exitsToday,
        entriesToday: stats.entriesToday,
        studentCount: stats.students
    };
    Object.keys(values).forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = values[id];
    });
    const greeting = document.querySelector('#welcomeMessage');
    if (greeting) greeting.textContent = `Welcome, ${user.username}`;
    const rows = gatePasses.slice(0, 10).map((pass) => {
        const student = pass.student || {};
        const actions = user.role === 'Warden' || user.role === 'Admin'
            ? pass.status === 'Pending'
                ? `<button class="btn btn-sm btn-success" data-review="Approved" data-id="${escapeHtml(pass._id)}">Approve</button>
                   <button class="btn btn-sm btn-outline-danger" data-review="Rejected" data-id="${escapeHtml(pass._id)}">Reject</button>`
                : passLink(pass._id)
            : passLink(pass._id);
        return `<tr>
            <td>${escapeHtml(pass._id.slice(-8).toUpperCase())}</td>
            <td>${escapeHtml(student.username || '—')}</td>
            <td>${escapeHtml(pass.passType)}</td>
            <td>${escapeHtml(pass.destination)}</td>
            <td>${escapeHtml(new Date(pass.exitAt).toLocaleString())}</td>
            <td>${statusBadge(pass.status)}</td>
            <td class="d-flex gap-1">${actions}</td>
        </tr>`;
    }).join('');
    document.querySelector('#recentPasses').innerHTML = rows || '<tr><td colspan="7" class="text-center text-muted py-4">No applications yet.</td></tr>';
    document.querySelector('#recentPasses').onclick = async (event) => {
        const button = event.target.closest('[data-review]');
        if (!button) return;
        let rejectionReason = '';
        if (button.dataset.review === 'Rejected') {
            rejectionReason = window.prompt('Enter the reason for rejection:') || '';
            if (!rejectionReason.trim()) return;
        }
        button.disabled = true;
        try {
            await HEMS.request(`/gate-passes/${button.dataset.id}/review`, {
                method: 'PATCH',
                body: JSON.stringify({ status: button.dataset.review, rejectionReason })
            });
            await loadDashboard(user);
        } catch (error) {
            showNotice(error.message, 'danger');
            button.disabled = false;
        }
    };
    const notificationList = document.querySelector('#latestNotifications');
    if (notificationList) {
        notificationList.innerHTML = notifications.slice(0, 4).map((item) =>
            `<li class="list-group-item ${item.readAt ? '' : 'fw-semibold'}">
                <span>${escapeHtml(item.title)}</span>
                <small class="d-block text-muted">${escapeHtml(item.message)}</small>
            </li>`
        ).join('') || '<li class="list-group-item text-muted">No notifications.</li>';
    }
}

async function loadApplyForm() {
    const { user } = await HEMS.request('/profile');
    document.querySelector('#studentSummary').textContent =
        `${user.username}${user.rollNumber ? ` · ${user.rollNumber}` : ''}${user.hostel ? ` · ${user.hostel}` : ''}${user.room ? ` · Room ${user.room}` : ''}`;
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.querySelector('#exitDate').min = localDate;
    document.querySelector('#returnDate').min = localDate;
    document.querySelector('#gatePassForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form));
        const message = document.querySelector('#formMessage');
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
            await HEMS.request('/gate-passes', { method: 'POST', body: JSON.stringify(payload) });
            HEMS.showMessage(message, 'Gate pass application submitted.', 'success');
            form.reset();
            document.querySelector('#exitDate').min = localDate;
            document.querySelector('#returnDate').min = localDate;
        } catch (error) {
            HEMS.showMessage(message, error.message);
        } finally {
            submit.disabled = false;
        }
    });
}

async function loadMyPasses() {
    const { gatePasses } = await HEMS.request('/gate-passes');
    const counts = { total: gatePasses.length, Pending: 0, Approved: 0, Rejected: 0 };
    gatePasses.forEach((pass) => { counts[pass.status] = (counts[pass.status] || 0) + 1; });
    document.querySelector('#totalPasses').textContent = counts.total;
    document.querySelector('#pendingPasses').textContent = counts.Pending;
    document.querySelector('#approvedPasses').textContent = counts.Approved;
    document.querySelector('#rejectedPasses').textContent = counts.Rejected;
    const rows = document.querySelector('#passRows');
    rows.innerHTML = gatePasses.map((pass) => `<tr>
        <td>${escapeHtml(pass._id.slice(-8).toUpperCase())}</td>
        <td>${escapeHtml(new Date(pass.exitAt).toLocaleDateString())}</td>
        <td>${escapeHtml(pass.passType)}</td>
        <td>${escapeHtml(pass.destination)}</td>
        <td>${statusBadge(pass.status)}${pass.rejectionReason ? `<small class="d-block text-danger">${escapeHtml(pass.rejectionReason)}</small>` : ''}</td>
        <td class="d-flex gap-1">${passLink(pass._id)}${pass.status === 'Pending' ? `<button class="btn btn-sm btn-outline-danger" data-cancel="${escapeHtml(pass._id)}">Cancel</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">No gate pass applications yet.</td></tr>';
    document.querySelector('#passFilter').oninput = filterPassRows;
    document.querySelector('#statusFilter').onchange = filterPassRows;
    rows.onclick = async (event) => {
        const button = event.target.closest('[data-cancel]');
        if (!button || !window.confirm('Cancel this pending gate pass application?')) return;
        button.disabled = true;
        try {
            await HEMS.request(`/gate-passes/${button.dataset.cancel}`, { method: 'DELETE' });
            await loadMyPasses();
        } catch (error) {
            showNotice(error.message, 'danger');
            button.disabled = false;
        }
    };
}

function filterPassRows() {
    const search = document.querySelector('#passFilter').value.toLowerCase();
    const status = document.querySelector('#statusFilter').value;
    document.querySelectorAll('#passRows tr').forEach((row) => {
        const statusCell = row.cells[4];
        row.hidden = !row.textContent.toLowerCase().includes(search) ||
            (status && (!statusCell || !statusCell.textContent.includes(status)));
    });
}

async function loadPassDetails() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) throw new Error('Choose a gate pass from your application list.');
    const { gatePass: pass } = await HEMS.request(`/gate-passes/${encodeURIComponent(id)}`);
    const student = pass.student || {};
    const values = {
        passId: pass._id,
        passType: pass.passType,
        destination: pass.destination,
        exitAt: formatDate(pass.exitAt),
        returnAt: formatDate(pass.returnAt),
        studentName: student.username,
        rollNumber: student.rollNumber,
        hostel: student.hostel,
        room: student.room,
        phone: student.phone,
        reason: pass.reason,
        rejectionReason: pass.rejectionReason || '—',
        status: pass.status,
        movement: pass.enteredAt ? `Returned at ${formatDate(pass.enteredAt)}` :
            pass.exitedAt ? `Exited at ${formatDate(pass.exitedAt)}` :
                pass.status === 'Approved' ? 'Awaiting exit' : 'Not authorized for exit'
    };
    Object.keys(values).forEach((key) => {
        const element = document.querySelector(`[data-pass="${key}"]`);
        if (element) element.textContent = values[key] || '—';
    });
    const qrLink = document.querySelector('#qrLink');
    if (qrLink) qrLink.href = `qr.html?id=${encodeURIComponent(pass._id)}`;
    const downloadButton = document.querySelector('#downloadPass');
    if (downloadButton) downloadButton.addEventListener('click', () => window.print());
    const qrImage = document.querySelector('#passQr');
    if (qrImage) {
        const { qrCode } = await HEMS.request(`/gate-passes/${encodeURIComponent(pass._id)}/qr`);
        qrImage.src = qrCode;
        qrImage.hidden = false;
    }
}

async function loadProfile() {
    const { user } = await HEMS.request('/profile');
    ['username', 'email', 'rollNumber', 'course', 'year', 'hostel', 'room', 'phone'].forEach((field) => {
        const input = document.getElementById(field);
        if (input) input.value = user[field] || '';
    });
    document.querySelector('#profileForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget));
        delete payload.email;
        try {
            await HEMS.request('/profile', { method: 'PATCH', body: JSON.stringify(payload) });
            HEMS.showMessage(document.querySelector('#profileMessage'), 'Profile updated.', 'success');
        } catch (error) {
            HEMS.showMessage(document.querySelector('#profileMessage'), error.message);
        }
    });
}

async function loadStudents() {
    const { students } = await HEMS.request('/students');
    const render = () => {
        const query = document.querySelector('#studentSearch').value.toLowerCase();
        const visible = students.filter((student) =>
            `${student.username} ${student.rollNumber} ${student.hostel} ${student.room}`.toLowerCase().includes(query));
        document.querySelector('#studentCount').textContent = visible.length;
        document.querySelector('#studentRows').innerHTML = visible.map((student) => `<tr>
            <td>${escapeHtml(student.username)}</td><td>${escapeHtml(student.rollNumber || '—')}</td>
            <td>${escapeHtml(student.course || '—')}</td><td>${escapeHtml(student.hostel || '—')}</td>
            <td>${escapeHtml(student.room || '—')}</td><td>${escapeHtml(student.email)}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No students found.</td></tr>';
    };
    render();
    document.querySelector('#studentSearch').addEventListener('input', render);
}

async function loadUsers() {
    const { users } = await HEMS.request('/admin/users');
    const rows = document.querySelector('#userRows');
    const render = () => {
        rows.innerHTML = users.map((user) => `<tr data-user-id="${escapeHtml(user._id)}">
            <td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td>
            <td class="d-flex gap-2"><select class="form-select form-select-sm" aria-label="Role for ${escapeHtml(user.username)}">
                ${['Student', 'Warden', 'SecurityGuard', 'Admin'].map((role) =>
                    `<option ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}
            </select><button class="btn btn-sm btn-outline-primary" data-save-role>Save</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No user accounts.</td></tr>';
    };
    render();
    rows.onclick = async (event) => {
        const button = event.target.closest('[data-save-role]');
        if (!button) return;
        const row = button.closest('[data-user-id]');
        button.disabled = true;
        try {
            await HEMS.request(`/admin/users/${encodeURIComponent(row.dataset.userId)}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role: row.querySelector('select').value })
            });
            HEMS.showMessage(document.querySelector('#pageNotice'), 'User role updated.', 'success');
            const { users: refreshedUsers } = await HEMS.request('/admin/users');
            users.splice(0, users.length, ...refreshedUsers);
            render();
        } catch (error) {
            showNotice(error.message, 'danger');
            button.disabled = false;
        }
    };
}

async function loadNotifications() {
    const { notifications } = await HEMS.request('/notifications');
    document.querySelector('#notificationRows').innerHTML = notifications.map((item) => `<tr>
        <td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.message)}</td>
        <td>${escapeHtml(formatDate(item.createdAt))}</td>
        <td>${item.readAt ? 'Read' : `<button class="btn btn-sm btn-outline-primary" data-read="${escapeHtml(item._id)}">Mark read</button>`}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No notifications.</td></tr>';
    document.querySelector('#notificationRows').onclick = async (event) => {
        const button = event.target.closest('[data-read]');
        if (!button) return;
        button.disabled = true;
        try {
            await HEMS.request(`/notifications/${button.dataset.read}/read`, { method: 'PATCH' });
            await loadNotifications();
        } catch (error) {
            showNotice(error.message, 'danger');
            button.disabled = false;
        }
    };
}

async function loadMovements() {
    const { movements } = await HEMS.request('/movements');
    document.querySelector('#movementRows').innerHTML = movements.map((item) => `<tr>
        <td>${escapeHtml(item.student && item.student.username)}</td>
        <td>${escapeHtml(item._id.slice(-8).toUpperCase())}</td>
        <td>${escapeHtml(formatDate(item.exitedAt))}</td>
        <td>${escapeHtml(item.exitGuard && item.exitGuard.username)}</td>
        <td>${escapeHtml(formatDate(item.enteredAt))}</td>
        <td>${escapeHtml(item.entryGuard && item.entryGuard.username)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No movement records.</td></tr>';
}

async function loadReports() {
    const { byStatus, recent } = await HEMS.request('/reports');
    document.querySelector('#reportStats').innerHTML = byStatus.map((row) =>
        `<div class="col-md-3"><div class="card card-body"><span>${escapeHtml(row._id)}</span><strong class="fs-3">${row.count}</strong></div></div>`
    ).join('') || '<p class="text-muted">No report data available.</p>';
    document.querySelector('#reportRows').innerHTML = recent.map((pass) => `<tr>
        <td>${escapeHtml(pass.student && pass.student.username)}</td><td>${escapeHtml(pass.passType)}</td>
        <td>${escapeHtml(pass.destination)}</td><td>${escapeHtml(formatDate(pass.exitAt))}</td>
        <td>${statusBadge(pass.status)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">No applications.</td></tr>';
}

async function recordMovement() {
    document.querySelector('#movementForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const id = form.elements.passId.value.trim();
        const action = form.elements.namedItem('action').value;
        try {
            const result = await HEMS.request(`/gate-passes/${encodeURIComponent(id)}/movement`, {
                method: 'PATCH',
                body: JSON.stringify({ action })
            });
            HEMS.showMessage(document.querySelector('#movementMessage'), result.message, 'success');
            form.reset();
        } catch (error) {
            HEMS.showMessage(document.querySelector('#movementMessage'), error.message);
        }
    });
}

async function startPortal() {
    const protectedPages = {
        dashboard: [],
        apply: ['Student'],
        passes: ['Student'],
        pass: [],
        profile: [],
        students: ['Admin', 'Warden'],
        notifications: [],
        movements: [],
        reports: ['Admin', 'Warden'],
        users: ['Admin'],
        qr: ['Student'],
        logout: []
    };
    const user = await HEMS.requireUser(protectedPages[page] || []);
    if (!user) return;
    displayUser(user);
    try {
        switch (page) {
            case 'dashboard':
                if (user.role === 'SecurityGuard') await recordMovement();
                await loadDashboard(user);
                break;
            case 'apply': await loadApplyForm(); break;
            case 'passes': await loadMyPasses(); break;
            case 'pass': await loadPassDetails(); break;
            case 'profile': await loadProfile(); break;
            case 'students': await loadStudents(); break;
            case 'notifications': await loadNotifications(); break;
            case 'movements': await loadMovements(); break;
            case 'reports': await loadReports(); break;
            case 'users': await loadUsers(); break;
            case 'qr': await loadPassDetails(); break;
            case 'logout':
                document.querySelector('#confirmLogout').addEventListener('click', async (event) => {
                    event.currentTarget.disabled = true;
                    try {
                        await HEMS.request('/auth/logout', { method: 'POST' });
                        HEMS.clearSession();
                        location.replace('login.html');
                    } catch (error) {
                        showNotice(error.message, 'danger');
                        event.currentTarget.disabled = false;
                    }
                });
                break;
        }
    } catch (error) {
        showNotice(error.message, 'danger');
    }
}

startPortal();
