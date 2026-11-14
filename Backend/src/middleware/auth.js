const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/StudentLogin');

async function requireAuth(req, res, next) {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

    if (!token || !process.env.JWT_SECRET) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'hostel-entry-exit' });
    } catch (_error) {
        return res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
    }

    if (!mongoose.isValidObjectId(payload.id)) {
        return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
    }

    const user = await User.findById(payload.id).select('+tokenVersion');
    if (!user) {
        return res.status(401).json({ message: 'Your account is no longer available.' });
    }
    if (payload.version !== user.tokenVersion) {
        return res.status(401).json({ message: 'Your session has been signed out. Please sign in again.' });
    }

    req.user = user;
    return next();
}

function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'You do not have permission to perform this action.' });
        }
        return next();
    };
}

module.exports = { requireAuth, allowRoles };
