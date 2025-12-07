const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const userSchema = new mongoose.Schema({}, { strict: false });
const postSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Follow = mongoose.model('Follow', followSchema);

async function fixKrinaVisibility() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const harvinder = await User.findById('68fa0a99696d2b1cf4f5143d');
    const krina = await User.findById('693027231dc71aa588c1023e');

    console.log('🔧 FIXING KRINA\'S VISIBILITY\n');

    // Step 1: Unarchive the post
    console.log('Step 1: Unarchiving Krina\'s post...');
    const result = await Post.findByIdAndUpdate(
      '6931736ada4deead28b6b07c',
      { is_archived: false },
      { new: true }
    );

    if (result) {
      console.log('✅ Post unarchived successfully');
      console.log(`   Post ID: ${result._id}`);
      console.log(`   Is Archived: ${result.is_archived}`);
    } else {
      console.log('❌ Failed to unarchive post');
    }

    // Step 2: Update Krina's post count
    console.log('\nStep 2: Updating Krina\'s post count...');
    const activePostCount = await Post.countDocuments({
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: { $ne: true }
    });

    await User.findByIdAndUpdate(krina._id, {
      posts_count: activePostCount
    });

    console.log(`✅ Post count updated: ${activePostCount}`);

    // Step 3: Create mutual follow relationship
    console.log('\nStep 3: Creating mutual follow relationship...');

    // Check if already exists
    const existingHtoK = await Follow.findOne({
      follower: harvinder._id,
      following: krina._id
    });

    const existingKtoH = await Follow.findOne({
      follower: krina._id,
      following: harvinder._id
    });

    if (!existingHtoK) {
      await Follow.create({
        follower: harvinder._id,
        following: krina._id,
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Harvinder now follows Krina');
    } else {
      console.log('ℹ️  Harvinder already follows Krina');
    }

    if (!existingKtoH) {
      await Follow.create({
        follower: krina._id,
        following: harvinder._id,
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Krina now follows Harvinder');
    } else {
      console.log('ℹ️  Krina already follows Harvinder');
    }

    // Step 4: Update follower/following counts
    console.log('\nStep 4: Updating follower/following counts...');

    const harvinderFollowingCount = await Follow.countDocuments({
      follower: harvinder._id,
      status: 'accepted'
    });
    const harvinderFollowersCount = await Follow.countDocuments({
      following: harvinder._id,
      status: 'accepted'
    });

    await User.findByIdAndUpdate(harvinder._id, {
      following_count: harvinderFollowingCount,
      followers_count: harvinderFollowersCount
    });

    const krinaFollowingCount = await Follow.countDocuments({
      follower: krina._id,
      status: 'accepted'
    });
    const krinaFollowersCount = await Follow.countDocuments({
      following: krina._id,
      status: 'accepted'
    });

    await User.findByIdAndUpdate(krina._id, {
      following_count: krinaFollowingCount,
      followers_count: krinaFollowersCount
    });

    console.log(`✅ Harvinder: ${harvinderFollowersCount} followers, ${harvinderFollowingCount} following`);
    console.log(`✅ Krina: ${krinaFollowersCount} followers, ${krinaFollowingCount} following`);

    // Final verification
    console.log('\n📊 FINAL VERIFICATION:\n');

    const updatedKrina = await User.findById(krina._id);
    console.log(`Krina's post count: ${updatedKrina.posts_count}`);
    console.log(`Krina's followers: ${updatedKrina.followers_count}`);
    console.log(`Krina's following: ${updatedKrina.following_count}`);

    const feedPosts = await Post.find({
      $or: [
        { user: krina._id },
        { user_id: krina._id }
      ],
      is_archived: { $ne: true }
    });

    console.log(`\nActive posts by Krina: ${feedPosts.length}`);
    
    if (feedPosts.length > 0) {
      console.log('\n✅ SUCCESS! Now:');
      console.log('   → Post will appear in Harvinder\'s feed');
      console.log('   → Post will appear on Krina\'s profile');
      console.log('   → Post count shows correctly');
      console.log('   → Mutual follow relationship established');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixKrinaVisibility();
