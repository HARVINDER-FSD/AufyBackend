const { MongoClient, ObjectId } = require('mongodb');

// Force Atlas connection
const MONGO_URI = 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function testEndpointLogic() {
  try {
    console.log('🔍 Testing endpoint logic directly...');
    
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();
    
    const username = 'its_harshit_01'; // User who has 1 reel
    
    console.log(`\n👤 Testing for user: ${username}`);
    
    // Step 1: Find user by username (same as backend)
    const targetUser = await db.collection('users').findOne({ username });
    if (!targetUser) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ User found: ${targetUser._id}`);
    
    // Step 2: Fetch posts (same as backend)
    const posts = await db.collection('posts').find({
      user_id: targetUser._id,
      is_archived: { $ne: true }
    }).sort({ created_at: -1 }).toArray();
    
    console.log(`📝 Posts found: ${posts.length}`);
    
    // Step 3: Fetch reels (same as backend)
    const reels = await db.collection('reels').find({
      user_id: targetUser._id,
      is_deleted: { $ne: true }
    }).sort({ created_at: -1 }).toArray();
    
    console.log(`🎬 Reels found: ${reels.length}`);
    
    if (reels.length > 0) {
      console.log('\n🎬 Reel details:');
      reels.forEach((reel, i) => {
        console.log(`   Reel ${i + 1}:`);
        console.log(`   - ID: ${reel._id}`);
        console.log(`   - Title: ${reel.title || reel.description || 'No title'}`);
        console.log(`   - Video URL: ${reel.video_url}`);
        console.log(`   - Thumbnail: ${reel.thumbnail_url || 'No thumbnail'}`);
        console.log(`   - Created: ${reel.created_at}`);
        console.log(`   - Is Deleted: ${reel.is_deleted || false}`);
      });
    }
    
    // Step 4: Transform data (same as backend)
    const transformedPosts = posts.map(post => ({
      id: post._id.toString(),
      type: post.type || (post.media_type === 'video' ? 'reel' : 'post'),
      media_type: post.media_type || 'text',
      content: post.content || '',
      created_at: post.created_at
    }));
    
    const transformedReels = reels.map(reel => ({
      id: reel._id.toString(),
      type: 'reel',
      media_type: 'video',
      content: reel.description || '',
      created_at: reel.created_at,
      video_url: reel.video_url,
      thumbnail_url: reel.thumbnail_url
    }));
    
    // Step 5: Combine and sort (same as backend)
    const allContent = [...transformedPosts, ...transformedReels].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    });
    
    console.log(`\n📊 Final result:`);
    console.log(`   - Total items: ${allContent.length}`);
    console.log(`   - Posts: ${allContent.filter(item => item.type !== 'reel').length}`);
    console.log(`   - Reels: ${allContent.filter(item => item.type === 'reel').length}`);
    
    if (allContent.length > 0) {
      console.log('\n📋 Items:');
      allContent.forEach((item, i) => {
        console.log(`   ${i + 1}. ID: ${item.id}, Type: ${item.type}, Media: ${item.media_type}`);
      });
    }
    
    await client.close();
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEndpointLogic();