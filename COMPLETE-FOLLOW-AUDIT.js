const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const userSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Follow = mongoose.model('Follow', followSchema);

async function completeFollowAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('   COMPLETE FOLLOW SYSTEM AUDIT');
    console.log('═══════════════════════════════════════════════════════\n');

    // Get all users
    const users = await User.find({}).select('_id username followers_count following_count');
    console.log(`📊 Total Users: ${users.length}\n`);

    // Get all follows
    const follows = await Follow.find({});
    console.log(`🔗 Total Follow Records: ${follows.length}\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('   USER-BY-USER ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const user of users) {
      console.log(`\n👤 USER: ${user.username} (${user._id})`);
      console.log('─'.repeat(60));

      // Get followers (who follows this user)
      const followers = await Follow.find({
        $or: [
          { following: user._id },
          { followingId: user._id }
        ],
        status: 'accepted'
      });

      // Get following (who this user follows)
      const following = await Follow.find({
        $or: [
          { follower: user._id },
          { followerId: user._id }
        ],
        status: 'accepted'
      });

      console.log(`\n📥 FOLLOWERS (${followers.length}):`);
      for (const follow of followers) {
        const followerId = follow.follower || follow.followerId;
        const follower = await User.findById(followerId);
        if (follower) {
          console.log(`   ✓ @${follower.username} follows @${user.username}`);
        }
      }

      console.log(`\n📤 FOLLOWING (${following.length}):`);
      for (const follow of following) {
        const followingId = follow.following || follow.followingId;
        const followedUser = await User.findById(followingId);
        if (followedUser) {
          console.log(`   ✓ @${user.username} follows @${followedUser.username}`);
        }
      }

      // Check for mutual follows
      const mutualFollows = [];
      for (const follow of following) {
        const followingId = follow.following || follow.followingId;
        const isMutual = followers.some(f => {
          const fId = f.follower || f.followerId;
          return fId.toString() === followingId.toString();
        });
        if (isMutual) {
          const mutualUser = await User.findById(followingId);
          if (mutualUser) {
            mutualFollows.push(mutualUser.username);
          }
        }
      }

      if (mutualFollows.length > 0) {
        console.log(`\n💕 MUTUAL FOLLOWS (${mutualFollows.length}):`);
        mutualFollows.forEach(username => {
          console.log(`   ✓ @${username} ↔️ @${user.username}`);
        });
      }

      // Check stored counts vs actual
      console.log(`\n📊 COUNT VERIFICATION:`);
      console.log(`   Stored followers_count: ${user.followers_count || 0}`);
      console.log(`   Actual followers: ${followers.length}`);
      console.log(`   Match: ${(user.followers_count || 0) === followers.length ? '✅' : '❌'}`);
      
      console.log(`   Stored following_count: ${user.following_count || 0}`);
      console.log(`   Actual following: ${following.length}`);
      console.log(`   Match: ${(user.following_count || 0) === following.length ? '✅' : '❌'}`);
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('   FOLLOW RELATIONSHIPS MATRIX');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('Legend: ✓ = follows, ✗ = does not follow, ↔️ = mutual\n');
    
    // Create matrix
    for (const user1 of users) {
      for (const user2 of users) {
        if (user1._id.toString() === user2._id.toString()) continue;

        const user1FollowsUser2 = await Follow.findOne({
          $or: [
            { follower: user1._id, following: user2._id },
            { followerId: user1._id, followingId: user2._id }
          ],
          status: 'accepted'
        });

        const user2FollowsUser1 = await Follow.findOne({
          $or: [
            { follower: user2._id, following: user1._id },
            { followerId: user2._id, followingId: user1._id }
          ],
          status: 'accepted'
        });

        if (user1FollowsUser2 && user2FollowsUser1) {
          console.log(`↔️  @${user1.username} ↔️ @${user2.username} (MUTUAL)`);
        } else if (user1FollowsUser2) {
          console.log(`→  @${user1.username} → @${user2.username}`);
        } else if (user2FollowsUser1) {
          console.log(`←  @${user1.username} ← @${user2.username}`);
        }
      }
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('   ISSUES FOUND');
    console.log('═══════════════════════════════════════════════════════\n');

    let issuesFound = false;

    // Check for count mismatches
    for (const user of users) {
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

      if ((user.followers_count || 0) !== actualFollowers) {
        console.log(`❌ @${user.username}: followers_count mismatch`);
        console.log(`   Stored: ${user.followers_count || 0}, Actual: ${actualFollowers}`);
        issuesFound = true;
      }

      if ((user.following_count || 0) !== actualFollowing) {
        console.log(`❌ @${user.username}: following_count mismatch`);
        console.log(`   Stored: ${user.following_count || 0}, Actual: ${actualFollowing}`);
        issuesFound = true;
      }
    }

    // Check for orphaned follows
    for (const follow of follows) {
      const followerId = follow.follower || follow.followerId;
      const followingId = follow.following || follow.followingId;

      const followerExists = await User.findById(followerId);
      const followingExists = await User.findById(followingId);

      if (!followerExists) {
        console.log(`❌ Orphaned follow: follower ${followerId} does not exist`);
        issuesFound = true;
      }

      if (!followingExists) {
        console.log(`❌ Orphaned follow: following ${followingId} does not exist`);
        issuesFound = true;
      }
    }

    if (!issuesFound) {
      console.log('✅ No issues found! All data is consistent.');
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('   RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('To fix any issues found:');
    console.log('1. Run: node api-server/fix-follow-counts.js');
    console.log('2. Clear app cache and reload');
    console.log('3. Test follow/unfollow functionality');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

completeFollowAudit();
