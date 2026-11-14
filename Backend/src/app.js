const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth.routes');
const gatePassRoutes = require('./routes/gatePass.routes');
const dataRoutes = require('./routes/data.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5500,http://localhost:5500')
    .split(',')
    .map((origin) => origin.trim());

app.disable('x-powered-by');
app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS.'));
    }
}));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    return res.status(connected ? 200 : 503).json({
        status: connected ? 'ok' : 'database unavailable'
    });
});
app.use('/api/auth', authRoutes);
app.use('/api/gate-passes', gatePassRoutes);
app.use('/api', dataRoutes);
app.use((_req, res) => res.status(404).json({ message: 'API route not found.' }));
app.use(errorHandler);

module.exports = app;
