require('dotenv').config();

const app = require('./src/app');
const ConnectDB = require('./src/db/db');

async function start() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 characters');
    }
    await ConnectDB();
    const port = Number(process.env.PORT) || 3000;
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server is running on port ${port}`);
    });
}

start().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
});
