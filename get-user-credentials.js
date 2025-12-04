// Get user credentials for testing
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function getUserCredentials() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    const users = await db.collection('users').find({}).toArray();
    
    console.log('📋 Users with followers/following:\n');
    
    for (const user of users) {
      if ((user.followers || 0) > 0 || (user.following || 0) > 0) {
        console.log(`Username: ${user.username}`);
        console.log(`Email: ${user.email}`);
        console.log(`Followers: ${user.followers || 0}`);
        console.log(`Following: ${user.following || 0}`);
        console.log(`Password: (hashed - use "Test123!" for test users)`);
        console.log('---');
      }
    }

    console.log('\n💡 To test in mobile app:');
    console.log('1. Login with one of these accounts');
    console.log('2. Go to profile');
    console.log('3. Tap on followers/following count');
    console.log('4. You should see the list!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

getUserCredentials();
