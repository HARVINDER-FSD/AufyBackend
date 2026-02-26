
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const TARGET_EMAIL = 'harvindersinghharvinder99999@gmail.com';

async function checkUser() {
  console.log('🔍 Checking for user:', TARGET_EMAIL);
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI missing');
    return;
  }

  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    
    const db = client.db();
    const user = await db.collection('users').findOne({ email: TARGET_EMAIL });
    
    if (user) {
      console.log('✅ User FOUND:', user._id);
      console.log('   Username:', user.username);
      console.log('   Email:', user.email);
    } else {
      console.log('❌ User NOT FOUND in database.');
      console.log('   Please Register first.');
    }

  } catch (error) {
    console.error('❌ DB Error:', error.message);
  } finally {
    if (client) await client.close();
  }
}

checkUser();
