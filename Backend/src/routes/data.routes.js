const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/StudentLogin');
const GatePass = require('../models/GatePass');
const Notification = require('../models/Notification');
const { requireAuth, allowRoles } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/profile', (req, res) => res.json({ user: req.user }));

router.patch('/profile', async (req, res) => {
    const allowed = ['username', 'rollNumber', 'course', 'year', 'hostel', 'room', 'phone'];
    const update = {};
    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] !== 'string' || req.body[field].trim().length > (field === 'username' ? 80 : 100)) {
                return res.status(400).json({ message: `Invalid ${field}.` });
            }
            update[field] = req.body[field].trim();
        }
    }
    if (update.username && update.username.length < 2) {
        return res.status(400).json({ message: 'Name must contain at least 2 characters.' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, {
        returnDocument: 'after',
        runValidators: true
    });
    return res.json({ message: 'Profile updated.', user });
});

router.get('/students', allowRoles('Admin', 'Warden'), async (_req, res) => {
    const students = await User.find({ role: 'Student' })
        .select('username email rollNumber course year hostel room phone createdAt')
        .sort({ username: 1 })
        .limit(500);
    return res.json({ students });
});

router.get('/admin/users', allowRoles('Admin'), async (_req, res) => {
    const users = await User.find()
        .select('username email role rollNumber hostel room createdAt')
        .sort({ username: 1 })
        .limit(500);
    return res.json({ users });
});

router.patch('/admin/users/:id/role', allowRoles('Admin'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }
    const allowedRoles = ['Student', 'Warden', 'SecurityGuard', 'Admin'];
    if (!allowedRoles.includes(req.body.role)) {
        return res.status(400).json({ message: 'Choose a valid user role.' });
    }
    if (String(req.user._id) === req.params.id && req.body.role !== 'Admin') {
        return res.status(400).json({ message: 'You cannot remove your own administrator access.' });
    }
    const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { role: req.body.role } },
        { returnDocument: 'after', runValidators: true }
    );
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({ message: 'User role updated.', user });
});

router.get('/notifications', async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(100);
    return res.json({ notifications });
});

router.patch('/notifications/:id/read', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid notification ID.' });
    }
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { $set: { readAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!notification) {
        return res.status(404).json({ message: 'Notification not found.' });
    }
    return res.json({ notification });
});

router.get('/dashboard/stats', async (req, res) => {
    const staffRoles = ['Admin', 'Warden', 'SecurityGuard'];
    const scoped = staffRoles.includes(req.user.role) ? {} : { student: req.user._id };
    const [total, pending, approved, rejected, exitsToday, entriesToday, students] = await Promise.all([
        GatePass.countDocuments(scoped),
        GatePass.countDocuments({ ...scoped, status: 'Pending' }),
        GatePass.countDocuments({ ...scoped, status: 'Approved' }),
        GatePass.countDocuments({ ...scoped, status: 'Rejected' }),
        GatePass.countDocuments({ ...scoped, exitedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
        GatePass.countDocuments({ ...scoped, enteredAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
        ['Admin', 'Warden'].includes(req.user.role) ? User.countDocuments({ role: 'Student' }) : 0
    ]);
    return res.json({
        stats: { total, pending, approved, rejected, exitsToday, entriesToday, students }
    });
});

router.get('/movements', async (req, res) => {
    const movementFilter = { $or: [{ exitedAt: { $ne: null } }, { enteredAt: { $ne: null } }] };
    const query = ['Admin', 'Warden', 'SecurityGuard'].includes(req.user.role)
        ? movementFilter
        : { ...movementFilter, student: req.user._id };
    const movements = await GatePass.find(query)
        .sort({ updatedAt: -1 })
        .populate('student', 'username rollNumber hostel room')
        .populate('exitGuard', 'username')
        .populate('entryGuard', 'username')
        .limit(200);
    return res.json({ movements });
});

router.get('/reports', allowRoles('Admin', 'Warden'), async (_req, res) => {
    const [byStatus, recent] = await Promise.all([
        GatePass.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        GatePass.find().sort({ createdAt: -1 }).limit(50)
            .populate('student', 'username rollNumber hostel room')
    ]);
    return res.json({ byStatus, recent });
});

module.exports = router;
