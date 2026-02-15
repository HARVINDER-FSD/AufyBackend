
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function listUsers() {
  console.log('🔍 Connecting to Database...');
  
  const client = await MongoClient.connect(MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true, // Bypass SSL issues locally
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  
  try {
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Count total users
    const count = await usersCollection.countDocuments();
    console.log(`\n📊 Total Users: ${count}\n`);

    // List recent users (Limit 10)
    const users = await usersCollection.find({})
      .sort({ _id: -1 }) // Newest first
      .limit(10)
      .project({ username: 1, email: 1, full_name: 1, created_at: 1 })
      .toArray();

    console.log('📝 Recent Users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

listUsers();
