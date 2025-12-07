// Create Complete Test Data
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function createTestData() {
  console.log('🎬 Creating Complete Test Data\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Get existing users
    const users = await db.collection('users').find({}).limit(5).toArray();
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users. Please register some users first.');
      await client.close();
      return;
    }
    
    console.log(`Found ${users.length} users:\n`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.username} (${u._id})`);
    });
    
    const user1 = users[0];
    const user2 = users[1];
    const user3 = users[2] || users[1];
    
    console.log(`\n📝 Creating test scenario:`);
    console.log(`   User 1: ${user1.username} (YOU)`);
    console.log(`   User 2: ${user2.username} (Friend)`);
    if (users.length > 2) {
      console.log(`   User 3: ${user3.username} (Another user)`);
    }
    
    // 1. Create mutual follow between User 1 and User 2
    console.log(`\n1️⃣ Creating mutual follow...`);
    
    // User 1 follows User 2
    await db.collection('follows').insertOne({
      followerId: user1._id,
      followingId: user2._id,
      status: 'accepted',
      createdAt: new Date()
    });
    console.log(`   ✅ ${user1.username} follows ${user2.username}`);
    
    // User 2 follows User 1
    await db.collection('follows').insertOne({
      followerId: user2._id,
      followingId: user1._id,
      status: 'accepted',
      createdAt: new Date()
    });
    console.log(`   ✅ ${user2.username} follows ${user1.username}`);
    
    // 2. User 3 follows User 1 (but User 1 doesn't follow back)
    if (users.length > 2 && user3._id.toString() !== user1._id.toString()) {
      console.log(`\n2️⃣ Creating one-way follow...`);
      await db.collection('follows').insertOne({
        followerId: user3._id,
        followingId: user1._id,
        status: 'accepted',
        createdAt: new Date()
      });
      console.log(`   ✅ ${user3.username} follows ${user1.username} (one-way)`);
    }
    
    // 3. Create posts for each user
    console.log(`\n3️⃣ Creating posts...`);
    
    // User 1's post
    const post1 = await db.collection('posts').insertOne({
      user_id: user1._id,
      content: `Hello from ${user1.username}! This is my first post 🎉`,
      media_urls: ['https://picsum.photos/400/400?random=1'],
      media_type: 'image',
      is_archived: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log(`   ✅ Created post for ${user1.username}`);
    
    // User 2's post
    const post2 = await db.collection('posts').insertOne({
      user_id: user2._id,
      content: `Hey everyone! ${user2.username} here 👋`,
      media_urls: ['https://picsum.photos/400/400?random=2'],
      media_type: 'image',
      is_archived: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log(`   ✅ Created post for ${user2.username}`);
    
    // User 3's post (if exists)
    if (users.length > 2) {
      const post3 = await db.collection('posts').insertOne({
        user_id: user3._id,
        content: `${user3.username} posting! 📸`,
        media_urls: ['https://picsum.photos/400/400?random=3'],
        media_type: 'image',
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`   ✅ Created post for ${user3.username}`);
    }
    
    // 4. Add some likes
    console.log(`\n4️⃣ Adding likes...`);
    
    // User 2 likes User 1's post
    await db.collection('likes').insertOne({
      user_id: user2._id,
      post_id: post1.insertedId,
      created_at: new Date()
    });
    console.log(`   ❤️  ${user2.username} liked ${user1.username}'s post`);
    
    // User 1 likes User 2's post
    await db.collection('likes').insertOne({
      user_id: user1._id,
      post_id: post2.insertedId,
      created_at: new Date()
    });
    console.log(`   ❤️  ${user1.username} liked ${user2.username}'s post`);
    
    // 5. Add some comments
    console.log(`\n5️⃣ Adding comments...`);
    
    await db.collection('comments').insertOne({
      post_id: post1.insertedId,
      user_id: user2._id,
      content: 'Great post! 🔥',
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log(`   💬 ${user2.username} commented on ${user1.username}'s post`);
    
    // 6. Create a reel
    console.log(`\n6️⃣ Creating reel...`);
    
    await db.collection('posts').insertOne({
      user_id: user1._id,
      content: `${user1.username}'s first reel! 🎬`,
      media_urls: ['https://picsum.photos/400/600?random=10'],
      media_type: 'reel',
      is_archived: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log(`   🎬 Created reel for ${user1.username}`);
    
    // 7. Verify final counts
    console.log(`\n7️⃣ Verifying final data...\n`);
    
    for (const user of users.slice(0, 3)) {
      const followers = await db.collection('follows').countDocuments({
        followingId: user._id,
        status: 'accepted'
      });
      
      const following = await db.collection('follows').countDocuments({
        followerId: user._id,
        status: 'accepted'
      });
      
      const posts = await db.collection('posts').countDocuments({
        user_id: user._id,
        is_archived: { $ne: true }
      });
      
      console.log(`   ${user.username}:`);
      console.log(`     Posts: ${posts}`);
      console.log(`     Followers: ${followers}`);
      console.log(`     Following: ${following}`);
    }
    
    console.log('\n✅ Test data created successfully!');
    console.log('\n📱 Now test in your app:');
    console.log(`   1. Login as: ${user1.username}`);
    console.log(`   2. Check profile - should show actual counts`);
    console.log(`   3. Check feed - should show ${user2.username}'s post`);
    console.log(`   4. Visit ${user2.username}'s profile - should show mutual follow`);
    console.log(`   5. Visit ${user3.username}'s profile - should show "Follow Back" button`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run
createTestData()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
