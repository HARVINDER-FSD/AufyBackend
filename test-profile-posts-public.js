require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function testPublicProfilePosts() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;

    // Get all users
    const users = await db.collection('users').find({}).toArray();
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 USER ACCOUNTS STATUS');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const user of users) {
      const postsCount = await db.collection('posts').countDocuments({
        user_id: user._id,
        is_archived: { $ne: true }
      });

      console.log(`👤 ${user.username}`);
      console.log(`   Account Type: ${user.is_private ? '🔒 Private' : '🌐 Public'}`);
      console.log(`   Posts: ${postsCount}`);
      console.log(`   ID: ${user._id}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ EXPECTED BEHAVIOR');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🌐 PUBLIC ACCOUNTS:');
    console.log('   ✓ Posts should be visible to everyone');
    console.log('   ✓ No login required to view posts');
    console.log('   ✓ Profile grid should show all posts\n');

    console.log('🔒 PRIVATE ACCOUNTS:');
    console.log('   ✓ Posts hidden from non-followers');
    console.log('   ✓ "This account is private" message shown');
    console.log('   ✓ Must follow to see posts\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST INSTRUCTIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const publicUsers = users.filter(u => !u.is_private);
    const privateUsers = users.filter(u => u.is_private);

    if (publicUsers.length > 0) {
      console.log('TEST 1: Public Account Posts Visibility');
      console.log('----------------------------------------');
      console.log(`1. Visit profile: ${publicUsers[0].username}`);
      console.log('2. Posts should be visible in grid');
      console.log('3. No "private account" message');
      console.log('4. Can view without following\n');
    }

    if (privateUsers.length > 0) {
      console.log('TEST 2: Private Account Posts Hidden');
      console.log('----------------------------------------');
      console.log(`1. Visit profile: ${privateUsers[0].username}`);
      console.log('2. Posts should be hidden');
      console.log('3. "This account is private" message shown');
      console.log('4. Must follow to see posts\n');
    }

    console.log('TEST 3: Create Test Posts');
    console.log('----------------------------------------');
    console.log('1. Login to your app');
    console.log('2. Create a new post with image');
    console.log('3. Visit your profile');
    console.log('4. Post should appear in grid');
    console.log('5. Logout and visit your profile again');
    console.log('6. Post should still be visible (if public)\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 READY TO TEST!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testPublicProfilePosts();
