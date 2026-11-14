function errorHandler(error, _req, res, _next) {
    if (error && error.message === 'Origin is not allowed by CORS.') {
        return res.status(403).json({ message: 'This origin is not allowed.' });
    }

    if (error && error.code === 11000) {
        return res.status(409).json({ message: 'A record with the supplied unique value already exists.' });
    }

    if (error && error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
    }

    if (error && error.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Request body must contain valid JSON.' });
    }

    console.error(error);
    return res.status(500).json({ message: 'An unexpected server error occurred.' });
}

module.exports = errorHandler;
