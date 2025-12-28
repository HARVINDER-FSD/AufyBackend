const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// Force Atlas connection
const MONGO_URI = 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

console.log('Using Atlas connection directly');

async function debugReels() {
  try {
    if (!MONGO_URI) {
      console.log('❌ MONGODB_URI not set');
      return;
    }

    console.log('\n🔍 Connecting to MongoDB...');
    console.log('URI type:', MONGO_URI.includes('mongodb+srv') ? 'Atlas' : 'Local');
    
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();
    
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n📊 Found ${users.length} users in database`);
    
    // Get all reels
    const allReels = await db.collection('reels').find({}).toArray();
    console.log(`\n🎬 Total reels in database: ${allReels.length}`);
    
    if (allReels.length > 0) {
      console.log('\n🎬 All reels in database:');
      for (let i = 0; i < allReels.length; i++) {
        const reel = allReels[i];
        const reelUser = users.find(u => u._id.toString() === reel.user_id.toString());
        console.log(`\n   Reel ${i + 1}:`);
        console.log(`   - ID: ${reel._id}`);
        console.log(`   - User ID: ${reel.user_id}`);
        console.log(`   - Username: ${reelUser ? reelUser.username : 'NOT FOUND'}`);
        console.log(`   - Title: ${reel.title || reel.description || 'No title'}`);
        console.log(`   - Video URL: ${reel.video_url}`);
        console.log(`   - Created: ${reel.created_at}`);
        console.log(`   - Is Deleted: ${reel.is_deleted || false}`);
      }
    }
    
    // Test the backend endpoint logic for each user
    console.log('\n🔍 Testing backend logic for each user:');
    for (const user of users) {
      console.log(`\n👤 User: ${user.username} (ID: ${user._id})`);
      
      // Fetch posts for this user
      const userPosts = await db.collection('posts').find({
        user_id: user._id,
        is_archived: { $ne: true }
      }).toArray();
      
      // Fetch reels for this user
      const userReels = await db.collection('reels').find({
        user_id: user._id,
        is_deleted: { $ne: true }
      }).toArray();
      
      console.log(`   - Posts: ${userPosts.length}`);
      console.log(`   - Reels: ${userReels.length}`);
      
      if (userReels.length > 0) {
        console.log(`   - Reel IDs: ${userReels.map(r => r._id).join(', ')}`);
      }
    }
    
    await client.close();
    console.log('\n✅ Debug complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugReels();
