require('dotenv').config({ path: __dirname + '/.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function listUsers() {
  console.log('📋 Listing all users...\n');
  console.log('MongoDB URI:', MONGODB_URI ? 'Found' : 'Not found');

  if (!MONGODB_URI) {
    console.log('❌ MONGODB_URI not found in environment');
    return;
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    const users = await db.collection('users').find({}).toArray();

    console.log(`✅ Found ${users.length} users:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Name: ${user.full_name || user.name || 'N/A'}`);
      console.log(`   Avatar: ${user.avatar_url || user.avatar || 'None'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

listUsers();
