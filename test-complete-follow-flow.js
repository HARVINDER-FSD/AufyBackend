require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false },
  pendingFollowRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

async function testCompleteFollowFlow() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const User = mongoose.model('User', UserSchema);

    // Get all users
    const users = await User.find({}).select('username email isPrivate followers following followersCount followingCount pendingFollowRequests');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 CURRENT DATABASE STATE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Private: ${user.isPrivate ? 'Yes' : 'No'}`);
      console.log(`   Followers: ${user.followersCount || 0} (Array: ${user.followers?.length || 0})`);
      console.log(`   Following: ${user.followingCount || 0} (Array: ${user.following?.length || 0})`);
      console.log(`   Pending Requests: ${user.pendingFollowRequests?.length || 0}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST SCENARIOS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find specific users for testing
    const harvinder = users.find(u => u.username === 'Its.harvinder.05');
    const monu = users.find(u => u.username === 'its_monu_0207');
    const krina = users.find(u => u.username === 'krinaprajapati24');
    const gstech = users.find(u => u.username === 'gs_techt');

    if (!harvinder || !monu || !krina || !gstech) {
      console.log('❌ Not all test users found!');
      return;
    }

    console.log('✅ Test Users Found:');
    console.log(`   - Harvinder (ID: ${harvinder._id})`);
    console.log(`   - Monu (ID: ${monu._id})`);
    console.log(`   - Krina (ID: ${krina._id})`);
    console.log(`   - GSTech (ID: ${gstech._id})`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 RECOMMENDED TEST FLOW');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('TEST 1: Public Account Follow (Instant)');
    console.log('----------------------------------------');
    console.log('1. Login as: Its.harvinder.05');
    console.log('2. Visit profile: its_monu_0207');
    console.log('3. Click Follow button');
    console.log('4. Expected: Button changes to "Following" instantly');
    console.log('5. Verify: Monu\'s followers count = 1, Harvinder\'s following count = 1');
    console.log('');

    console.log('TEST 2: Private Account Follow Request');
    console.log('----------------------------------------');
    console.log('1. Make krinaprajapati24 private (Settings > Privacy > Private Account)');
    console.log('2. Login as: Its.harvinder.05');
    console.log('3. Visit profile: krinaprajapati24');
    console.log('4. Click Follow button');
    console.log('5. Expected: Button changes to "Requested"');
    console.log('6. Login as: krinaprajapati24');
    console.log('7. Go to Settings > Follow Requests');
    console.log('8. Accept Harvinder\'s request');
    console.log('9. Expected: Krina\'s followers count = 1, Harvinder\'s following count = 2');
    console.log('');

    console.log('TEST 3: Unfollow');
    console.log('----------------------------------------');
    console.log('1. Login as: Its.harvinder.05');
    console.log('2. Visit profile: its_monu_0207');
    console.log('3. Click "Following" button');
    console.log('4. Confirm unfollow');
    console.log('5. Expected: Button changes to "Follow"');
    console.log('6. Verify: Monu\'s followers count = 0, Harvinder\'s following count = 1');
    console.log('');

    console.log('TEST 4: Follow List Visibility');
    console.log('----------------------------------------');
    console.log('1. Login as: Its.harvinder.05');
    console.log('2. Visit your profile');
    console.log('3. Click on "Following" count');
    console.log('4. Expected: See list of users you follow');
    console.log('5. Visit: its_monu_0207 profile');
    console.log('6. Click on "Followers" count');
    console.log('7. Expected: See list of Monu\'s followers');
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 WHAT TO CHECK');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✓ Follow button state changes instantly');
    console.log('✓ Counts update in real-time');
    console.log('✓ Private accounts show "Requested" state');
    console.log('✓ Follow requests appear in settings');
    console.log('✓ Unfollow confirmation dialog appears');
    console.log('✓ Follow lists show correct users');
    console.log('✓ Profile posts visibility respects privacy settings');
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 READY TO TEST!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Start your mobile app and follow the test scenarios above.');
    console.log('After testing, run this script again to verify database state.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testCompleteFollowFlow();
