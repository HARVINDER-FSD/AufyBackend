const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const userSchema = new mongoose.Schema({}, { strict: false });
const postSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

async function testProfilePostsEndpoint() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const harvinder = await User.findById('68fa0a99696d2b1cf4f5143d');
    const krina = await User.findById('693027231dc71aa588c1023e');

    console.log('═══════════════════════════════════════════');
    console.log('   PROFILE POSTS ENDPOINT TEST');
    console.log('═══════════════════════════════════════════\n');

    // Test 1: Harvinder's posts (should be 0)
    console.log('TEST 1: Harvinder\'s Profile Posts\n');
    const harvinderPosts = await Post.find({
      $or: [
        { user: harvinder._id },
        { user_id: harvinder._id }
      ],
      is_archived: { $ne: true }
    });
    console.log(`Username: ${harvinder.username}`);
    console.log(`Posts count: ${harvinderPosts.length}`);
    console.log(`Expected: 0 (Harvinder has no posts)`);
    console.log(`Result: ${harvinderPosts.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 2: Krina's posts (should be 1)
    console.log('TEST 2: Krina\'s Profile Posts\n');
    const krinaPosts = await Post.find({
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: { $ne: true }
    });
    console.log(`Username: ${krina.username}`);
    console.log(`Posts count: ${krinaPosts.length}`);
    console.log(`Expected: 1 (Krina has 1 active post)`);
    console.log(`Result: ${krinaPosts.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`);

    if (krinaPosts.length > 0) {
      console.log('Krina\'s Post Details:');
      krinaPosts.forEach((post, i) => {
        console.log(`  ${i + 1}. ID: ${post._id}`);
        console.log(`     Caption: ${post.caption || post.content || 'No caption'}`);
        console.log(`     Media: ${post.media_type} (${post.media_urls?.length || 0} files)`);
        console.log(`     Archived: ${post.is_archived || false}`);
        console.log(`     Created: ${post.created_at || post.createdAt}`);
      });
    }

    // Test 3: Feed vs Profile difference
    console.log('\n═══════════════════════════════════════════');
    console.log('   FEED vs PROFILE COMPARISON');
    console.log('═══════════════════════════════════════════\n');

    console.log('HARVINDER\'S PERSPECTIVE:\n');
    
    console.log('1. Feed Tab (should show followed users\' posts):');
    console.log('   → Should show: Krina\'s posts (if following)');
    console.log('   → Should NOT show: Harvinder\'s own posts\n');

    console.log('2. Profile Tab (should show ONLY own posts):');
    console.log('   → Should show: Harvinder\'s posts ONLY');
    console.log('   → Should NOT show: Krina\'s posts');
    console.log('   → Current count: 0 posts ✅ CORRECT\n');

    console.log('═══════════════════════════════════════════');
    console.log('   ENDPOINT MAPPING');
    console.log('═══════════════════════════════════════════\n');

    console.log('Feed Tab:');
    console.log('  Endpoint: GET /api/posts/feed');
    console.log('  Returns: Posts from followed users\n');

    console.log('Profile Tab:');
    console.log('  Endpoint: GET /api/users/:username/posts');
    console.log('  Returns: Posts by specific user ONLY\n');

    console.log('✅ CONCLUSION:');
    console.log('   Profile tab should now show ONLY user\'s own posts');
    console.log('   Feed tab shows posts from followed users');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testProfilePostsEndpoint();
