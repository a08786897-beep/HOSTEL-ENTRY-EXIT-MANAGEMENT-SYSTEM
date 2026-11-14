const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'studentLoginModel',
        required: true,
        index: true
    },
    gatePass: { type: mongoose.Schema.Types.ObjectId, ref: 'GatePass', default: null },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    readAt: { type: Date, default: null }
}, { timestamps: true });

NotificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
