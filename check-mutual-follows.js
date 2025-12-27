// Check mutual follows in database
require('dotenv').config({ path: __dirname + '/.env' });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = '68fa0a99696d2b1cf4f5143d'; // Its.harvinder.05

async function checkMutualFollows() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    console.log('👤 Checking follows for user:', USER_ID);
    const userId = new ObjectId(USER_ID);

    // Get users this user is following
    console.log('\n📤 Users I am following:');
    const following = await db.collection('follows')
      .find({ follower_id: userId })
      .toArray();
    
    console.log(`Found ${following.length} follows`);
    for (const follow of following) {
      const user = await db.collection('users').findOne({ _id: follow.following_id });
      console.log(`  - Following: ${user?.username} (ID: ${follow.following_id})`);
    }

    // Get users who follow this user
    console.log('\n📥 Users who follow me:');
    const followers = await db.collection('follows')
      .find({ following_id: userId })
      .toArray();
    
    console.log(`Found ${followers.length} followers`);
    for (const follow of followers) {
      const user = await db.collection('users').findOne({ _id: follow.follower_id });
      console.log(`  - Follower: ${user?.username} (ID: ${follow.follower_id})`);
    }

    // Find mutual follows
    console.log('\n🤝 Mutual follows (I follow them AND they follow me):');
    const followingIds = following.map(f => f.following_id.toString());
    const followerIds = followers.map(f => f.follower_id.toString());
    
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    console.log(`Found ${mutualIds.length} mutual follows`);
    
    for (const mutualId of mutualIds) {
      const user = await db.collection('users').findOne({ _id: new ObjectId(mutualId) });
      console.log(`  - Mutual: ${user?.username} (ID: ${mutualId})`);
    }

    if (mutualIds.length === 0) {
      console.log('\n⚠️  No mutual follows found!');
      console.log('This means none of the people you follow are following you back.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkMutualFollows();
