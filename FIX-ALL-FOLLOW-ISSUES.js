const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Follow = mongoose.model('Follow', followSchema);

async function fixAllFollowIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔧 FIXING ALL FOLLOW ISSUES\n');

    // Step 1: Remove orphaned follows
    console.log('Step 1: Removing orphaned follows...');
    const follows = await Follow.find({});
    let orphanedCount = 0;

    for (const follow of follows) {
      const followerId = follow.follower || follow.followerId;
      const followingId = follow.following || follow.followingId;

      const followerExists = await User.findById(followerId);
      const followingExists = await User.findById(followingId);

      if (!followerExists || !followingExists) {
        await Follow.deleteOne({ _id: follow._id });
        console.log(`   ❌ Deleted orphaned follow: ${follow._id}`);
        orphanedCount++;
      }
    }
    console.log(`✅ Removed ${orphanedCount} orphaned follows\n`);

    // Step 2: Fix all user counts
    console.log('Step 2: Fixing user counts...');
    const users = await User.find({});

    for (const user of users) {
      // Count actual followers
      const actualFollowers = await Follow.countDocuments({
        $or: [
          { following: user._id },
          { followingId: user._id }
        ],
        status: 'accepted'
      });

      // Count actual following
      const actualFollowing = await Follow.countDocuments({
        $or: [
          { follower: user._id },
          { followerId: user._id }
        ],
        status: 'accepted'
      });

      // Update user
      await User.findByIdAndUpdate(user._id, {
        followers_count: actualFollowers,
        following_count: actualFollowing
      });

      console.log(`   ✅ @${user.username}:`);
      console.log(`      Followers: ${user.followers_count || 0} → ${actualFollowers}`);
      console.log(`      Following: ${user.following_count || 0} → ${actualFollowing}`);
    }

    console.log('\n✅ ALL ISSUES FIXED!\n');

    // Verify
    console.log('═══════════════════════════════════════════');
    console.log('   VERIFICATION');
    console.log('═══════════════════════════════════════════\n');

    const updatedUsers = await User.find({}).select('username followers_count following_count');
    for (const user of updatedUsers) {
      const actualFollowers = await Follow.countDocuments({
        $or: [
          { following: user._id },
          { followingId: user._id }
        ],
        status: 'accepted'
      });

      const actualFollowing = await Follow.countDocuments({
        $or: [
          { follower: user._id },
          { followerId: user._id }
        ],
        status: 'accepted'
      });

      const followersMatch = user.followers_count === actualFollowers;
      const followingMatch = user.following_count === actualFollowing;

      console.log(`@${user.username}:`);
      console.log(`   Followers: ${user.followers_count} ${followersMatch ? '✅' : '❌'}`);
      console.log(`   Following: ${user.following_count} ${followingMatch ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixAllFollowIssues();
