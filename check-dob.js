
require('dotenv').config({ path: '../.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkRecentUser() {
  console.log('🔍 Checking for the most recently registered user...');
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI missing');
    return;
  }

  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    
    const db = client.db();
    const user = await db.collection('users').find().sort({ _id: -1 }).limit(1).toArray();
    
    if (user && user.length > 0) {
      const u = user[0];
      console.log('✅ Recent User FOUND:', u._id);
      console.log('   Username:', u.username);
      console.log('   Email:', u.email);
      console.log('   DOB Field:', u.dob);
      console.log('   Date of Birth Field:', u.date_of_birth);
      // console.log('   Full User Data:', JSON.stringify(u, null, 2));
    } else {
      console.log('❌ No users found in database.');
    }

  } catch (error) {
    console.error('❌ DB Error:', error.message);
  } finally {
    if (client) await client.close();
  }
}

checkRecentUser();
