
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function makeAdmin() {
    const username = process.argv[2];
    if (!username) {
        console.log('Please provide a username: node makeAdmin.js <username>');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const result = await db.collection('users').updateOne(
            { username: username },
            { $set: { role: 'admin', is_verified: true } }
        );

        if (result.matchedCount === 0) {
            console.log(`User "${username}" not found.`);
        } else {
            console.log(`Successfully made "${username}" an admin.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

makeAdmin();
