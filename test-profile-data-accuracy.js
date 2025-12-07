// Test Profile Data Accuracy
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function testProfileDataAccuracy() {
  console.log('🔍 Testing Profile Data Accuracy\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Get all users
    const users = await db.collection('users').find({}).limit(5).toArray();
    
    console.log(`Found ${users.length} users to test\n`);
    
    for (const user of users) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing User: ${user.username} (${user._id})`);
      console.log('='.repeat(60));
      
      // 1. Check actual followers count
      const actualFollowers = await db.collection('follows').countDocuments({
        followingId: user._id,
        status: 'accepted'
      });
      
      // 2. Check actual following count
      const actualFollowing = await db.collection('follows').countDocuments({
        followerId: user._id,
        status: 'accepted'
      });
      
      // 3. Check actual posts count
      const actualPosts = await db.collection('posts').countDocuments({
        user_id: user._id,
        is_archived: { $ne: true }
      });
      
      // 4. Get followers list
      const followersList = await db.collection('follows').find({
        followingId: user._id,
        status: 'accepted'
      }).toArray();
      
      // 5. Get following list
      const followingList = await db.collection('follows').find({
        followerId: user._id,
        status: 'accepted'
      }).toArray();
      
      console.log('\n📊 ACTUAL DATA FROM DATABASE:');
      console.log(`  Posts: ${actualPosts}`);
      console.log(`  Followers: ${actualFollowers}`);
      console.log(`  Following: ${actualFollowing}`);
      
      console.log('\n📝 STORED IN USER DOCUMENT:');
      console.log(`  posts_count: ${user.posts_count || 0}`);
      console.log(`  followers_count: ${user.followers_count || user.followers || 0}`);
      console.log(`  following_count: ${user.following_count || user.following || 0}`);
      
      console.log('\n✅ MATCHES:');
      console.log(`  Posts: ${actualPosts === (user.posts_count || 0) ? '✅' : '❌ MISMATCH'}`);
      console.log(`  Followers: ${actualFollowers === (user.followers_count || user.followers || 0) ? '✅' : '❌ MISMATCH'}`);
      console.log(`  Following: ${actualFollowing === (user.following_count || user.following || 0) ? '✅' : '❌ MISMATCH'}`);
      
      if (followersList.length > 0) {
        console.log('\n👥 FOLLOWERS LIST:');
        for (const follow of followersList.slice(0, 3)) {
          const follower = await db.collection('users').findOne({ _id: follow.followerId });
          console.log(`  - ${follower?.username || 'Unknown'} (${follow.followerId})`);
        }
        if (followersList.length > 3) {
          console.log(`  ... and ${followersList.length - 3} more`);
        }
      }
      
      if (followingList.length > 0) {
        console.log('\n👤 FOLLOWING LIST:');
        for (const follow of followingList.slice(0, 3)) {
          const following = await db.collection('users').findOne({ _id: follow.followingId });
          console.log(`  - ${following?.username || 'Unknown'} (${follow.followingId})`);
        }
        if (followingList.length > 3) {
          console.log(`  ... and ${followingList.length - 3} more`);
        }
      }
      
      // Check for pending requests
      const pendingRequests = await db.collection('followRequests').countDocuments({
        requested_id: user._id,
        status: 'pending'
      });
      
      if (pendingRequests > 0) {
        console.log(`\n⏳ PENDING FOLLOW REQUESTS: ${pendingRequests}`);
      }
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    // Check for orphaned follows (follows without users)
    const allFollows = await db.collection('follows').find({}).toArray();
    let orphanedFollows = 0;
    
    for (const follow of allFollows) {
      const follower = await db.collection('users').findOne({ _id: follow.followerId });
      const following = await db.collection('users').findOne({ _id: follow.followingId });
      
      if (!follower || !following) {
        orphanedFollows++;
      }
    }
    
    if (orphanedFollows > 0) {
      console.log(`\n⚠️  Found ${orphanedFollows} orphaned follow records (users don't exist)`);
    }
    
    // Check for follows without status
    const followsWithoutStatus = await db.collection('follows').countDocuments({
      status: { $exists: false }
    });
    
    if (followsWithoutStatus > 0) {
      console.log(`\n⚠️  Found ${followsWithoutStatus} follow records without status field`);
    }
    
    console.log('\n✅ Profile data accuracy test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testProfileDataAccuracy()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
