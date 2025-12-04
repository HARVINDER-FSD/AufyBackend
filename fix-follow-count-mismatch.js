// Fix Follow Count Mismatch - Diagnose and fix count vs list discrepancies
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function fixFollowCountMismatch() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  console.log('🔍 Analyzing follow count mismatches...\n');

  try {
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    
    console.log(`📊 Checking ${users.length} users...\n`);

    for (const user of users) {
      const userId = user._id;
      const username = user.username;

      // Count ALL followers (including pending)
      const allFollowersCount = await db.collection('follows').countDocuments({
        followingId: userId
      });

      // Count ACCEPTED followers only
      const acceptedFollowersCount = await db.collection('follows').countDocuments({
        followingId: userId,
        status: 'accepted'
      });

      // Count PENDING followers
      const pendingFollowersCount = await db.collection('follows').countDocuments({
        followingId: userId,
        status: 'pending'
      });

      // Count ALL following (including pending)
      const allFollowingCount = await db.collection('follows').countDocuments({
        followerId: userId
      });

      // Count ACCEPTED following only
      const acceptedFollowingCount = await db.collection('follows').countDocuments({
        followerId: userId,
        status: 'accepted'
      });

      // Count PENDING following
      const pendingFollowingCount = await db.collection('follows').countDocuments({
        followerId: userId,
        status: 'pending'
      });

      // Check for mismatches
      const hasFollowerMismatch = allFollowersCount !== acceptedFollowersCount;
      const hasFollowingMismatch = allFollowingCount !== acceptedFollowingCount;

      if (hasFollowerMismatch || hasFollowingMismatch) {
        console.log(`⚠️  User: ${username} (${userId})`);
        
        if (hasFollowerMismatch) {
          console.log(`   Followers: ${acceptedFollowersCount} accepted + ${pendingFollowersCount} pending = ${allFollowersCount} total`);
          
          // Show pending followers
          if (pendingFollowersCount > 0) {
            const pendingFollowers = await db.collection('follows').find({
              followingId: userId,
              status: 'pending'
            }).toArray();
            
            for (const follow of pendingFollowers) {
              const follower = await db.collection('users').findOne({ _id: follow.followerId });
              console.log(`      - Pending from: ${follower?.username || 'unknown'}`);
            }
          }
        }

        if (hasFollowingMismatch) {
          console.log(`   Following: ${acceptedFollowingCount} accepted + ${pendingFollowingCount} pending = ${allFollowingCount} total`);
          
          // Show pending following
          if (pendingFollowingCount > 0) {
            const pendingFollowing = await db.collection('follows').find({
              followerId: userId,
              status: 'pending'
            }).toArray();
            
            for (const follow of pendingFollowing) {
              const following = await db.collection('users').findOne({ _id: follow.followingId });
              console.log(`      - Pending to: ${following?.username || 'unknown'} (private: ${following?.is_private || false})`);
            }
          }
        }
        
        console.log('');
      }
    }

    console.log('\n📋 Summary:');
    console.log('The count mismatch happens when:');
    console.log('1. Someone sends a follow request to a private account (status: pending)');
    console.log('2. The count includes ALL follows, but the list only shows ACCEPTED follows');
    console.log('');
    console.log('✅ Solution: Update count logic to only count accepted follows');
    console.log('');

    // Fix: Update all user counts to reflect only accepted follows
    console.log('🔧 Fixing user counts...\n');

    for (const user of users) {
      const userId = user._id;
      
      const acceptedFollowersCount = await db.collection('follows').countDocuments({
        followingId: userId,
        status: 'accepted'
      });

      const acceptedFollowingCount = await db.collection('follows').countDocuments({
        followerId: userId,
        status: 'accepted'
      });

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            followers_count: acceptedFollowersCount,
            following_count: acceptedFollowingCount
          }
        }
      );

      console.log(`✅ Updated ${user.username}: ${acceptedFollowersCount} followers, ${acceptedFollowingCount} following`);
    }

    console.log('\n✅ All user counts updated!');
    console.log('');
    console.log('📝 Note: The API endpoints already filter by status: "accepted"');
    console.log('   So the lists are correct. The counts just needed to match.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixFollowCountMismatch().catch(console.error);
