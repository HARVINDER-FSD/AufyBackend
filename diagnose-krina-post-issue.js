const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const userSchema = new mongoose.Schema({}, { strict: false });
const postSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Follow = mongoose.model('Follow', followSchema);

async function diagnoseKrinaPostIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get users
    const harvinder = await User.findById('68fa0a99696d2b1cf4f5143d');
    const krina = await User.findById('693027231dc71aa588c1023e');

    if (!harvinder || !krina) {
      console.log('❌ Users not found');
      return;
    }

    console.log('👥 USERS:');
    console.log(`Harvinder: ${harvinder.username} (${harvinder._id})`);
    console.log(`Krina: ${krina.username} (${krina._id})\n`);

    // Check Krina's post
    console.log('📝 KRINA\'S POST:\n');
    const krinaPost = await Post.findById('6931736ada4deead28b6b07c');
    
    if (krinaPost) {
      console.log('Post found:');
      console.log(`  ID: ${krinaPost._id}`);
      console.log(`  User ID: ${krinaPost.user_id || krinaPost.user}`);
      console.log(`  Caption: ${krinaPost.caption || krinaPost.content || 'No caption'}`);
      console.log(`  Media Type: ${krinaPost.media_type}`);
      console.log(`  Media URLs: ${krinaPost.media_urls?.length || 0} items`);
      console.log(`  Is Archived: ${krinaPost.is_archived}`);
      console.log(`  Created: ${krinaPost.created_at || krinaPost.createdAt}`);
      console.log(`  Updated: ${krinaPost.updated_at || krinaPost.updatedAt}`);
      
      if (krinaPost.is_archived) {
        console.log('\n⚠️  POST IS ARCHIVED!');
        console.log('   → This is why it doesn\'t show in feed');
        console.log('   → This is why it doesn\'t show in profile');
        console.log('   → This is why post_count is 0');
      }
    } else {
      console.log('❌ Post not found with ID: 6931736ada4deead28b6b07c');
    }

    // Count all Krina's posts
    console.log('\n📊 KRINA\'S POST STATISTICS:\n');
    const totalPosts = await Post.countDocuments({ 
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ]
    });
    const activePosts = await Post.countDocuments({ 
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: { $ne: true }
    });
    const archivedPosts = await Post.countDocuments({ 
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: true
    });

    console.log(`Total posts: ${totalPosts}`);
    console.log(`Active posts: ${activePosts}`);
    console.log(`Archived posts: ${archivedPosts}`);
    console.log(`\nUser's posts_count field: ${krina.posts_count || 0}`);

    // Check follow relationship
    console.log('\n🔗 FOLLOW RELATIONSHIP:\n');
    
    const harvinderFollowsKrina = await Follow.findOne({
      follower: harvinder._id,
      following: krina._id
    });
    
    const krinaFollowsHarvinder = await Follow.findOne({
      follower: krina._id,
      following: harvinder._id
    });

    if (harvinderFollowsKrina) {
      console.log(`✅ Harvinder follows Krina`);
      console.log(`   Status: ${harvinderFollowsKrina.status}`);
      console.log(`   Created: ${harvinderFollowsKrina.createdAt || harvinderFollowsKrina.created_at}`);
    } else {
      console.log('❌ Harvinder does NOT follow Krina');
    }

    if (krinaFollowsHarvinder) {
      console.log(`✅ Krina follows Harvinder`);
      console.log(`   Status: ${krinaFollowsHarvinder.status}`);
      console.log(`   Created: ${krinaFollowsHarvinder.createdAt || krinaFollowsHarvinder.created_at}`);
    } else {
      console.log('❌ Krina does NOT follow Harvinder');
    }

    // Simulate feed query
    console.log('\n📱 FEED SIMULATION (Harvinder\'s perspective):\n');
    
    if (harvinderFollowsKrina && harvinderFollowsKrina.status === 'accepted') {
      const feedPosts = await Post.find({
        $or: [
          { user: krina._id },
          { user_id: krina._id }
        ],
        is_archived: { $ne: true }
      }).sort({ created_at: -1, createdAt: -1 });

      console.log(`Posts that should appear in Harvinder's feed: ${feedPosts.length}`);
      
      if (feedPosts.length === 0) {
        console.log('✅ CORRECT: No active posts, so feed is empty');
      } else {
        feedPosts.forEach((post, i) => {
          console.log(`  ${i + 1}. ${post.caption || post.content || 'No caption'}`);
        });
      }
    } else {
      console.log('❌ Harvinder doesn\'t follow Krina (or not accepted)');
      console.log('   → No posts will appear in feed');
    }

    // Check profile visibility
    console.log('\n👤 PROFILE PAGE SIMULATION:\n');
    
    const profilePosts = await Post.find({
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: { $ne: true }
    }).sort({ created_at: -1, createdAt: -1 });

    console.log(`Posts visible on Krina's profile: ${profilePosts.length}`);
    
    if (profilePosts.length === 0) {
      console.log('✅ CORRECT: No active posts, so profile shows 0 posts');
    }

    // Solution
    console.log('\n💡 SOLUTION:\n');
    console.log('To make the post visible:');
    console.log('1. Unarchive the post (set is_archived to false)');
    console.log('2. Or create a new post that is not archived');
    console.log('\nWould you like me to unarchive this post? (Y/N)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

diagnoseKrinaPostIssue();
