const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({}, { strict: false });
const followSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Follow = mongoose.model('Follow', followSchema);

async function freshStart() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔄 FRESH START - Removing all follow relationships\n');
    console.log('Users will remain, but all connections will be removed.\n');

    // Get all users first
    const users = await User.find({}).select('username');
    console.log(`📊 Found ${users.length} users:`);
    users.forEach(u => console.log(`   - @${u.username}`));
    console.log('');

    // Delete ALL follow records
    const deleteResult = await Follow.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} follow records\n`);

    // Reset all user counts to 0
    console.log('🔄 Resetting all follower/following counts to 0...\n');
    
    for (const user of users) {
      await User.findByIdAndUpdate(user._id, {
        followers_count: 0,
        following_count: 0
      });
      console.log(`   ✅ @${user.username}: 0 followers, 0 following`);
    }

    console.log('\n✅ FRESH START COMPLETE!\n');
    console.log('═══════════════════════════════════════════');
    console.log('   CURRENT STATE');
    console.log('═══════════════════════════════════════════\n');

    const updatedUsers = await User.find({}).select('username followers_count following_count');
    updatedUsers.forEach(u => {
      console.log(`@${u.username}:`);
      console.log(`   Followers: ${u.followers_count || 0}`);
      console.log(`   Following: ${u.following_count || 0}`);
      console.log('');
    });

    console.log('✅ All users are now independent with no connections.');
    console.log('You can now test follow/unfollow from scratch!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

freshStart();
