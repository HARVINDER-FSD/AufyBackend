// Create test follow relationships
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function createTestFollows() {
  console.log('🔧 Creating test follow relationships...\n');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users`);

    if (users.length < 2) {
      console.log('❌ Need at least 2 users to create follows');
      await client.close();
      return;
    }

    // Clear existing follows
    await db.collection('follows').deleteMany({});
    console.log('✅ Cleared existing follows');

    // Create some follow relationships
    const follows = [];
    
    // User 0 follows User 1
    if (users[0] && users[1]) {
      follows.push({
        followerId: users[0]._id,
        followingId: users[1]._id,
        createdAt: new Date(),
        status: 'accepted'
      });
      console.log(`✅ ${users[0].username} → ${users[1].username}`);
    }

    // User 1 follows User 0 (mutual)
    if (users[1] && users[0]) {
      follows.push({
        followerId: users[1]._id,
        followingId: users[0]._id,
        createdAt: new Date(),
        status: 'accepted'
      });
      console.log(`✅ ${users[1].username} → ${users[0].username}`);
    }

    // User 2 follows User 0
    if (users[2] && users[0]) {
      follows.push({
        followerId: users[2]._id,
        followingId: users[0]._id,
        createdAt: new Date(),
        status: 'accepted'
      });
      console.log(`✅ ${users[2].username} → ${users[0].username}`);
    }

    // User 0 follows User 2
    if (users[0] && users[2]) {
      follows.push({
        followerId: users[0]._id,
        followingId: users[2]._id,
        createdAt: new Date(),
        status: 'accepted'
      });
      console.log(`✅ ${users[0].username} → ${users[2].username}`);
    }

    // Insert all follows
    if (follows.length > 0) {
      await db.collection('follows').insertMany(follows);
      console.log(`\n✅ Created ${follows.length} follow relationships`);
    }

    // Update user counts
    for (const user of users) {
      const followersCount = await db.collection('follows').countDocuments({
        followingId: user._id,
        status: 'accepted'
      });
      const followingCount = await db.collection('follows').countDocuments({
        followerId: user._id,
        status: 'accepted'
      });

      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            followers: followersCount,
            following: followingCount,
            followers_count: followersCount,
            following_count: followingCount
          } 
        }
      );

      console.log(`✅ Updated ${user.username}: ${followersCount} followers, ${followingCount} following`);
    }

    console.log('\n✅ Test data created successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

createTestFollows();
