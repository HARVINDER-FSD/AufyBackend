const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Follow = mongoose.model('Follow', followSchema);

async function removeMonuKrinaFollow() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const monu = await User.findOne({ username: 'its_monu_0207' });
    const krina = await User.findOne({ username: 'krinaprajapati24' });

    if (!monu || !krina) {
      console.log('❌ Users not found');
      return;
    }

    console.log('🔍 Checking follow relationship...\n');
    console.log(`Monu ID: ${monu._id}`);
    console.log(`Krina ID: ${krina._id}\n`);

    // Find the follow record
    const followRecord = await Follow.findOne({
      $or: [
        { follower: monu._id, following: krina._id },
        { followerId: monu._id, followingId: krina._id }
      ]
    });

    if (followRecord) {
      console.log('✓ Follow record found:', followRecord._id);
      console.log('  Deleting...\n');
      
      await Follow.deleteOne({ _id: followRecord._id });
      console.log('✅ Follow record deleted\n');

      // Update counts
      console.log('Updating counts...');
      
      // Monu's following count
      const monuFollowing = await Follow.countDocuments({
        $or: [
          { follower: monu._id },
          { followerId: monu._id }
        ],
        status: 'accepted'
      });

      // Krina's followers count
      const krinaFollowers = await Follow.countDocuments({
        $or: [
          { following: krina._id },
          { followingId: krina._id }
        ],
        status: 'accepted'
      });

      await User.findByIdAndUpdate(monu._id, { following_count: monuFollowing });
      await User.findByIdAndUpdate(krina._id, { followers_count: krinaFollowers });

      console.log(`✅ Monu following: ${monuFollowing}`);
      console.log(`✅ Krina followers: ${krinaFollowers}\n`);

      console.log('✅ DONE! Monu no longer follows Krina');
    } else {
      console.log('ℹ️  No follow record found - Monu already doesn\'t follow Krina');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

removeMonuKrinaFollow();
