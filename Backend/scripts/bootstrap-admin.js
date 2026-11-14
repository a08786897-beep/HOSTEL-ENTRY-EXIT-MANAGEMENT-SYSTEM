require('dotenv').config();

const mongoose = require('mongoose');
const ConnectDB = require('../src/db/db');
const User = require('../src/models/StudentLogin');

async function bootstrapAdmin() {
    const email = process.argv[2];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Provide the email address of an already registered user.');
    }

    await ConnectDB();
    if (await User.exists({ role: 'Admin' })) {
        throw new Error('An administrator already exists; use the Admin user-management page.');
    }

    const user = await User.findOneAndUpdate(
        { email: email.trim().toLowerCase() },
        { $set: { role: 'Admin' } },
        { returnDocument: 'after', runValidators: true }
    );
    if (!user) {
        throw new Error('No registered account was found with that email address.');
    }
    console.log('Administrator role assigned.');
}

bootstrapAdmin()
    .catch((error) => {
        console.error('Administrator setup failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState) await mongoose.disconnect();
    });
