const mongoose = require('mongoose');

async function ConnectDB(){
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required to connect to MongoDB');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected DB");
}

module.exports=ConnectDB;