// Make a user public for testing
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function makePublic() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Make Its.harvinder.05 public
    const result = await db.collection('users').updateOne(
      { username: 'Its.harvinder.05' },
      { $set: { is_private: false } }
    );

    console.log('✅ Made Its.harvinder.05 public');
    console.log('Modified:', result.modifiedCount);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

makePublic();
