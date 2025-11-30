// Check what users exist in database
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function checkUsers() {
  console.log('🔍 Checking users in database...\n');
  
  let client;
  
  try {
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();
    const usersCollection = db.collection('users');

    // Get total count
    const totalUsers = await usersCollection.countDocuments();
    console.log('📊 Total users:', totalUsers);
    console.log('');

    // Get first 5 users
    const users = await usersCollection.find({})
      .limit(5)
      .project({ 
        username: 1, 
        email: 1, 
        full_name: 1,
        is_verified: 1,
        badge_type: 1,
        isPremium: 1,
        resetPasswordToken: 1,
        resetPasswordExpires: 1
      })
      .toArray();

    console.log('👥 Sample users:');
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.username || 'No username'}`);
      console.log('   Email:', user.email || 'No email');
      console.log('   Full Name:', user.full_name || 'No name');
      console.log('   Verified:', user.is_verified || false);
      console.log('   Badge:', user.badge_type || 'none');
      console.log('   Premium:', user.isPremium || false);
      console.log('   Has Reset Token:', !!user.resetPasswordToken);
      if (user.resetPasswordExpires) {
        const now = new Date();
        const expires = new Date(user.resetPasswordExpires);
        const isExpired = now > expires;
        console.log('   Token Status:', isExpired ? 'Expired' : 'Valid');
      }
    });

    console.log('\n✅ Database check complete!');
    console.log('\n💡 To test forgot password, use one of these emails:');
    users.forEach(user => {
      if (user.email) {
        console.log('   -', user.email);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkUsers();
