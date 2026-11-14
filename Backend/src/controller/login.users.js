const userModel = require('../models/StudentLogin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function createToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required to sign authentication tokens');
    }

    return jwt.sign(
        { id: user.id, version: user.tokenVersion || 0 },
        process.env.JWT_SECRET,
        { expiresIn: '8h', issuer: 'hostel-entry-exit' }
    );
}

async function RegisterUser(req, res) {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (username.length < 2 || username.length > 80 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 8 || password.length > 128) {
        return res.status(400).json({
            message: 'Provide a name, valid email address, and password between 8 and 128 characters.'
        });
    }

    const existing = await userModel.findOne({
        $or: [{ username }, { email }]
    }).select('_id');

    if (existing) {
        return res.status(409).json({ message: 'An account with that name or email already exists.' });
    }

    const user = await userModel.create({
        username,
        email,
        password: await bcrypt.hash(password, 12),
        role: 'Student'
    });

    return res.status(201).json({
        message: 'Registration successful.',
        token: createToken(user),
        user
    });
}

async function LoginUser(req, res) {
    const identifier = typeof req.body.identifier === 'string'
        ? req.body.identifier.trim()
        : typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Email or username and password are required.' });
    }

    const user = await userModel.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier }
        ]
    }).select('+password +tokenVersion');

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid email/username or password.' });
    }

    return res.status(200).json({
        message: 'Login successful.',
        token: createToken(user),
        user
    });
}

module.exports = { RegisterUser, LoginUser };
