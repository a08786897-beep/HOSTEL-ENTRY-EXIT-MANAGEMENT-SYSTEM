const mongoose = require('mongoose');

const GatePassSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'studentLoginModel',
        required: true,
        index: true
    },
    passType: { type: String, required: true, trim: true, maxlength: 40 },
    destination: { type: String, required: true, trim: true, maxlength: 200 },
    exitAt: { type: Date, required: true },
    returnAt: { type: Date, required: true },
    parentContact: { type: String, required: true, trim: true, maxlength: 20 },
    emergencyContact: { type: String, trim: true, maxlength: 20, default: '' },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
        index: true
    },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'studentLoginModel', default: null },
    reviewedAt: { type: Date, default: null },
    exitedAt: { type: Date, default: null },
    exitGuard: { type: mongoose.Schema.Types.ObjectId, ref: 'studentLoginModel', default: null },
    enteredAt: { type: Date, default: null },
    entryGuard: { type: mongoose.Schema.Types.ObjectId, ref: 'studentLoginModel', default: null }
}, { timestamps: true });

GatePassSchema.index({ student: 1, exitAt: 1, returnAt: 1 });

module.exports = mongoose.model('GatePass', GatePassSchema);
