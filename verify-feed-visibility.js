const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas directly since models are in TypeScript
const userSchema = new mongoose.Schema({}, { strict: false });
const postSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Follow = mongoose.model('Follow', followSchema);

async function verifyFeedVisibility() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get both users
    const krina = await User.findOne({ username: 'krinaprajapati24' });
    const harvinder = await User.findOne({ username: 'Its.harvinder.05' });

    if (!krina || !harvinder) {
      console.log('❌ Users not found');
      return;
    }

    console.log('\n📊 USER DATA:\n');
    
    console.log('👤 Krina:');
    console.log(`  ID: ${krina._id}`);
    console.log(`  Username: ${krina.username}`);
    console.log(`  Posts count: ${krina.posts_count || 0}`);
    const krinaPosts = await Post.countDocuments({ user: krina._id });
    console.log(`  Actual posts: ${krinaPosts}`);
    
    console.log('\n👤 Harvinder:');
    console.log(`  ID: ${harvinder._id}`);
    console.log(`  Username: ${harvinder.username}`);
    console.log(`  Posts count: ${harvinder.posts_count || 0}`);
    const harvinderPosts = await Post.countDocuments({ user: harvinder._id });
    console.log(`  Actual posts: ${harvinderPosts}`);

    // Check follow relationship
    console.log('\n🔗 FOLLOW RELATIONSHIP:\n');
    
    const krinaFollowsHarvinder = await Follow.findOne({
      follower: krina._id,
      following: harvinder._id,
      status: 'accepted'
    });
    
    const harvinderFollowsKrina = await Follow.findOne({
      follower: harvinder._id,
      following: krina._id,
      status: 'accepted'
    });

    console.log(`Krina follows Harvinder: ${krinaFollowsHarvinder ? '✅ YES' : '❌ NO'}`);
    console.log(`Harvinder follows Krina: ${harvinderFollowsKrina ? '✅ YES' : '❌ NO'}`);

    // Simulate feed for Krina
    console.log('\n📱 KRINA\'S FEED SIMULATION:\n');
    
    if (krinaFollowsHarvinder) {
      const harvinderPostsInFeed = await Post.find({ user: harvinder._id });
      console.log(`Harvinder's posts that would appear: ${harvinderPostsInFeed.length}`);
      
      if (harvinderPostsInFeed.length === 0) {
        console.log('✅ CORRECT: Harvinder has 0 posts, so nothing appears in feed');
        console.log('✅ CORRECT: Harvinder\'s profile pic should NOT appear in feed');
      } else {
        console.log('⚠️  Harvinder has posts:');
        harvinderPostsInFeed.forEach((post, i) => {
          console.log(`  ${i + 1}. ${post.caption || 'No caption'} (${post.createdAt})`);
        });
      }
    } else {
      console.log('❌ Krina doesn\'t follow Harvinder, so no posts in feed');
    }

    // Simulate feed for Harvinder
    console.log('\n📱 HARVINDER\'S FEED SIMULATION:\n');
    
    if (harvinderFollowsKrina) {
      const krinaPostsInFeed = await Post.find({ user: krina._id });
      console.log(`Krina's posts that would appear: ${krinaPostsInFeed.length}`);
      
      if (krinaPostsInFeed.length === 0) {
        console.log('✅ CORRECT: Krina has 0 posts, so nothing appears in feed');
        console.log('✅ CORRECT: Krina\'s profile pic should NOT appear in feed');
      } else {
        console.log('⚠️  Krina has posts:');
        krinaPostsInFeed.forEach((post, i) => {
          console.log(`  ${i + 1}. ${post.caption || 'No caption'} (${post.createdAt})`);
        });
      }
    } else {
      console.log('❌ Harvinder doesn\'t follow Krina, so no posts in feed');
    }

    console.log('\n✅ CONCLUSION:');
    console.log('If both users have 0 actual posts:');
    console.log('  → Feed should be EMPTY');
    console.log('  → No profile pictures should appear');
    console.log('  → This is CORRECT Instagram behavior');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

verifyFeedVisibility();
