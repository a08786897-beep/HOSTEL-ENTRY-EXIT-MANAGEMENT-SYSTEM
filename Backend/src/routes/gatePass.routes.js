const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const GatePass = require('../models/GatePass');
const Notification = require('../models/Notification');
const { requireAuth, allowRoles } = require('../middleware/auth');

const router = express.Router();
const staffRoles = ['Admin', 'Warden', 'SecurityGuard'];

router.use(requireAuth);

router.get('/', async (req, res) => {
    const query = staffRoles.includes(req.user.role) ? {} : { student: req.user._id };
    const passes = await GatePass.find(query)
        .sort({ createdAt: -1 })
        .populate('student', 'username email rollNumber hostel room')
        .populate('reviewedBy', 'username')
        .populate('exitGuard', 'username')
        .populate('entryGuard', 'username')
        .limit(200);
    return res.json({ gatePasses: passes });
});

router.post('/', allowRoles('Student'), async (req, res) => {
    const {
        passType, destination, exitDate, exitTime, returnDate, returnTime,
        parentContact, emergencyContact = '', address = '', reason
    } = req.body;

    const requiredText = [passType, destination, exitDate, exitTime, returnDate, returnTime, parentContact, reason];
    if (requiredText.some((value) => typeof value !== 'string' || !value.trim())) {
        return res.status(400).json({ message: 'Complete all required gate pass fields.' });
    }
    if (!/^[\d+()\-\s]{7,20}$/.test(parentContact) ||
        (emergencyContact && !/^[\d+()\-\s]{7,20}$/.test(emergencyContact))) {
        return res.status(400).json({ message: 'Provide a valid contact number.' });
    }

    const exitAt = new Date(`${exitDate}T${exitTime}:00`);
    const returnAt = new Date(`${returnDate}T${returnTime}:00`);
    if (Number.isNaN(exitAt.getTime()) || Number.isNaN(returnAt.getTime()) || returnAt <= exitAt) {
        return res.status(400).json({ message: 'Return time must be later than the exit time.' });
    }
    if (exitAt < new Date(Date.now() - 60_000)) {
        return res.status(400).json({ message: 'Exit time cannot be in the past.' });
    }
    if (passType.trim().length > 40 || destination.trim().length > 200 ||
        reason.trim().length > 1000 || address.length > 500) {
        return res.status(400).json({ message: 'One or more fields exceed the allowed length.' });
    }

    const overlapping = await GatePass.exists({
        student: req.user._id,
        status: { $in: ['Pending', 'Approved'] },
        exitAt: { $lt: returnAt },
        returnAt: { $gt: exitAt },
        $or: [{ status: 'Pending' }, { enteredAt: null }]
    });
    if (overlapping) {
        return res.status(409).json({ message: 'You already have a pending or active pass for that period.' });
    }

    const gatePass = await GatePass.create({
        student: req.user._id,
        passType: passType.trim(),
        destination: destination.trim(),
        exitAt,
        returnAt,
        parentContact: parentContact.trim(),
        emergencyContact: emergencyContact.trim(),
        address: address.trim(),
        reason: reason.trim()
    });
    await Notification.create({
        user: req.user._id,
        gatePass: gatePass._id,
        title: 'Gate pass submitted',
        message: `Your ${gatePass.passType} request is awaiting review.`
    });
    return res.status(201).json({ message: 'Gate pass application submitted.', gatePass });
});

router.get('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid gate pass ID.' });
    }
    const gatePass = await GatePass.findById(req.params.id)
        .populate('student', 'username email rollNumber course year hostel room phone')
        .populate('reviewedBy', 'username')
        .populate('exitGuard', 'username')
        .populate('entryGuard', 'username');
    if (!gatePass) {
        return res.status(404).json({ message: 'Gate pass not found.' });
    }
    if (!staffRoles.includes(req.user.role) && !gatePass.student._id.equals(req.user._id)) {
        return res.status(403).json({ message: 'You do not have permission to view this gate pass.' });
    }
    return res.json({ gatePass });
});

router.delete('/:id', allowRoles('Student'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid gate pass ID.' });
    }
    const gatePass = await GatePass.findOneAndDelete({
        _id: req.params.id,
        student: req.user._id,
        status: 'Pending'
    });
    if (!gatePass) {
        const existing = await GatePass.exists({ _id: req.params.id, student: req.user._id });
        return res.status(existing ? 409 : 404).json({
            message: existing
                ? 'Only pending applications can be cancelled.'
                : 'Gate pass not found.'
        });
    }
    return res.json({ message: 'Gate pass application cancelled.' });
});

router.get('/:id/qr', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid gate pass ID.' });
    }
    const gatePass = await GatePass.findById(req.params.id);
    if (!gatePass) {
        return res.status(404).json({ message: 'Gate pass not found.' });
    }
    if (!staffRoles.includes(req.user.role) && !gatePass.student.equals(req.user._id)) {
        return res.status(403).json({ message: 'You do not have permission to verify this gate pass.' });
    }
    if (gatePass.status !== 'Approved') {
        return res.status(409).json({ message: 'A QR code is available only for approved gate passes.' });
    }
    if (gatePass.returnAt <= new Date()) {
        return res.status(410).json({ message: 'This gate pass has expired.' });
    }
    const qrCode = await QRCode.toDataURL(gatePass._id.toString(), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320
    });
    return res.json({ qrCode, validUntil: gatePass.returnAt });
});

router.patch('/:id/review', allowRoles('Admin', 'Warden'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid gate pass ID.' });
    }
    const { status, rejectionReason = '' } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }
    if (status === 'Rejected' && (typeof rejectionReason !== 'string' || !rejectionReason.trim())) {
        return res.status(400).json({ message: 'A reason is required when rejecting an application.' });
    }

    const gatePass = await GatePass.findOneAndUpdate(
        { _id: req.params.id, status: 'Pending' },
        {
            $set: {
                status,
                rejectionReason: status === 'Rejected' ? rejectionReason.trim().slice(0, 500) : '',
                reviewedBy: req.user._id,
                reviewedAt: new Date()
            }
        },
        { returnDocument: 'after' }
    );
    if (!gatePass) {
        const exists = await GatePass.exists({ _id: req.params.id });
        return res.status(exists ? 409 : 404).json({
            message: exists ? 'This application has already been reviewed.' : 'Gate pass not found.'
        });
    }
    await Notification.create({
        user: gatePass.student,
        gatePass: gatePass._id,
        title: `Gate pass ${status.toLowerCase()}`,
        message: status === 'Rejected'
            ? `Your request was rejected: ${gatePass.rejectionReason}`
            : 'Your gate pass is approved and ready for hostel gate verification.'
    });
    return res.json({ message: `Gate pass ${status.toLowerCase()}.`, gatePass });
});

router.patch('/:id/movement', allowRoles('SecurityGuard'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid gate pass ID.' });
    }
    const { action } = req.body;
    if (!['exit', 'entry'].includes(action)) {
        return res.status(400).json({ message: 'Action must be exit or entry.' });
    }

    const now = new Date();
    const condition = action === 'exit'
        ? {
            _id: req.params.id,
            status: 'Approved',
            exitedAt: null,
            enteredAt: null,
            exitAt: { $lte: now },
            returnAt: { $gte: now }
        }
        : { _id: req.params.id, status: 'Approved', exitedAt: { $ne: null }, enteredAt: null };
    const update = action === 'exit'
        ? { $set: { exitedAt: now, exitGuard: req.user._id } }
        : { $set: { enteredAt: now, entryGuard: req.user._id } };
    const gatePass = await GatePass.findOneAndUpdate(condition, update, { returnDocument: 'after' })
        .populate('student', 'username rollNumber');
    if (!gatePass) {
        const exists = await GatePass.exists({ _id: req.params.id });
        return res.status(exists ? 409 : 404).json({
            message: exists
                ? 'Pass is not currently valid for this movement or it has already been recorded.'
                : 'Gate pass not found.'
        });
    }
    await Notification.create({
        user: gatePass.student._id,
        gatePass: gatePass._id,
        title: action === 'exit' ? 'Hostel exit recorded' : 'Hostel entry recorded',
        message: `Security recorded your ${action} at ${now.toLocaleString()}.`
    });
    return res.json({ message: `Student ${action} recorded.`, gatePass });
});

module.exports = router;
