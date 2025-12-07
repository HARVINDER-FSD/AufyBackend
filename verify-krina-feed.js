const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const userSchema = new mongoose.Schema({}, { strict: false });
const postSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Follow = mongoose.model('Follow', followSchema);

async function verifyKrinaFeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const harvinder = await User.findById('68fa0a99696d2b1cf4f5143d');
    const krina = await User.findById('693027231dc71aa588c1023e');

    console.log('═══════════════════════════════════════════');
    console.log('   COMPLETE FEED VERIFICATION');
    console.log('═══════════════════════════════════════════\n');

    // User Info
    console.log('👥 USERS:\n');
    console.log(`Harvinder (@${harvinder.username})`);
    console.log(`  Posts: ${harvinder.posts_count || 0}`);
    console.log(`  Followers: ${harvinder.followers_count || 0}`);
    console.log(`  Following: ${harvinder.following_count || 0}`);
    
    console.log(`\nKrina (@${krina.username})`);
    console.log(`  Posts: ${krina.posts_count || 0}`);
    console.log(`  Followers: ${krina.followers_count || 0}`);
    console.log(`  Following: ${krina.following_count || 0}`);

    // Follow Status
    console.log('\n🔗 FOLLOW STATUS:\n');
    
    const hFollowsK = await Follow.findOne({
      follower: harvinder._id,
      following: krina._id,
      status: 'accepted'
    });
    
    const kFollowsH = await Follow.findOne({
      follower: krina._id,
      following: harvinder._id,
      status: 'accepted'
    });

    console.log(`Harvinder → Krina: ${hFollowsK ? '✅ Following' : '❌ Not following'}`);
    console.log(`Krina → Harvinder: ${kFollowsH ? '✅ Following' : '❌ Not following'}`);

    // Krina's Posts
    console.log('\n📝 KRINA\'S POSTS:\n');
    
    const allPosts = await Post.find({
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ]
    });

    const activePosts = allPosts.filter(p => !p.is_archived);
    const archivedPosts = allPosts.filter(p => p.is_archived);

    console.log(`Total posts: ${allPosts.length}`);
    console.log(`Active posts: ${activePosts.length}`);
    console.log(`Archived posts: ${archivedPosts.length}`);

    if (activePosts.length > 0) {
      console.log('\nActive Posts:');
      activePosts.forEach((post, i) => {
        console.log(`  ${i + 1}. ID: ${post._id}`);
        console.log(`     Caption: ${post.caption || post.content || 'No caption'}`);
        console.log(`     Media: ${post.media_type} (${post.media_urls?.length || 0} files)`);
        console.log(`     Created: ${post.created_at || post.createdAt}`);
      });
    }

    // Feed Simulation
    console.log('\n📱 HARVINDER\'S FEED:\n');
    
    if (hFollowsK) {
      console.log('✅ Harvinder follows Krina, checking feed posts...\n');
      
      const feedPosts = await Post.find({
        $or: [
          { user: krina._id },
          { user_id: krina._id }
        ],
        is_archived: { $ne: true }
      }).sort({ created_at: -1, createdAt: -1 });

      if (feedPosts.length > 0) {
        console.log(`✅ ${feedPosts.length} post(s) will appear in feed:`);
        feedPosts.forEach((post, i) => {
          console.log(`\n  Post ${i + 1}:`);
          console.log(`    By: @${krina.username}`);
          console.log(`    Caption: ${post.caption || post.content || 'No caption'}`);
          console.log(`    Media: ${post.media_type}`);
          console.log(`    Posted: ${post.created_at || post.createdAt}`);
        });
      } else {
        console.log('❌ No posts will appear (all archived or deleted)');
      }
    } else {
      console.log('❌ Harvinder doesn\'t follow Krina');
      console.log('   No posts will appear in feed');
    }

    // Profile Visibility
    console.log('\n👤 KRINA\'S PROFILE PAGE:\n');
    
    const profilePosts = await Post.find({
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: { $ne: true }
    });

    console.log(`Posts visible on profile: ${profilePosts.length}`);
    console.log(`Post count shown: ${krina.posts_count || 0}`);
    
    if (profilePosts.length === (krina.posts_count || 0)) {
      console.log('✅ Post count matches actual posts');
    } else {
      console.log('⚠️  Post count mismatch!');
    }

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('   SUMMARY');
    console.log('═══════════════════════════════════════════\n');

    const allGood = 
      hFollowsK && 
      kFollowsH && 
      activePosts.length > 0 && 
      krina.posts_count === activePosts.length;

    if (allGood) {
      console.log('✅ ALL SYSTEMS WORKING!');
      console.log('   → Mutual follow relationship: YES');
      console.log('   → Active posts: YES');
      console.log('   → Post counts accurate: YES');
      console.log('   → Feed will show posts: YES');
      console.log('   → Profile will show posts: YES');
    } else {
      console.log('⚠️  ISSUES DETECTED:');
      if (!hFollowsK) console.log('   → Harvinder needs to follow Krina');
      if (!kFollowsH) console.log('   → Krina needs to follow Harvinder');
      if (activePosts.length === 0) console.log('   → No active posts available');
      if (krina.posts_count !== activePosts.length) console.log('   → Post count needs update');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

verifyKrinaFeed();
