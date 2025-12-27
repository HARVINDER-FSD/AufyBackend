// Test follow state after FollowContext fix
require('dotenv').config({ path: __dirname + '/.env' });

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';
const TEST_EMAIL = 'hs8339952@gmail.com';
const TEST_PASSWORD = 'abc123';

async function testFollowState() {
  console.log('🧪 Testing Follow State After Fix\n');
  console.log('API URL:', API_URL);
  console.log('Test User:', TEST_EMAIL);
  console.log('');

  try {
    // 1. Login
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    const currentUserId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, `(${currentUserId})`);
    console.log('');

    // 2. Get following list
    console.log('2️⃣ Fetching following list...');
    const followingRes = await fetch(`${API_URL}/api/users/${currentUserId}/following`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!followingRes.ok) {
      throw new Error(`Failed to fetch following: ${followingRes.status}`);
    }

    const followingData = await followingRes.json();
    const following = Array.isArray(followingData) ? followingData : (followingData.data || []);
    console.log(`✅ Following ${following.length} users:`);
    following.forEach(user => {
      console.log(`   - ${user.username} (${user.id})`);
    });
    console.log('');

    // 3. Get a reel and check follow state
    console.log('3️⃣ Fetching reels to check follow state...');
    const reelsRes = await fetch(`${API_URL}/api/reels`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!reelsRes.ok) {
      throw new Error(`Failed to fetch reels: ${reelsRes.status}`);
    }

    const reelsData = await reelsRes.json();
    const reels = Array.isArray(reelsData) ? reelsData : (reelsData.data || []);
    
    if (reels.length === 0) {
      console.log('⚠️  No reels found');
      return;
    }

    console.log(`✅ Found ${reels.length} reels\n`);

    // Check first reel
    const firstReel = reels[0];
    console.log('📹 First Reel:');
    console.log('   User:', firstReel.user.username, `(${firstReel.user.id})`);
    console.log('   Backend is_following:', firstReel.is_following);
    console.log('   User.is_following:', firstReel.user.is_following);
    console.log('');

    // Check if this user is in following list
    const isInFollowingList = following.some(u => String(u.id) === String(firstReel.user.id));
    console.log('   In following list:', isInFollowingList);
    console.log('');

    // Summary
    console.log('📊 Summary:');
    console.log('   Total following:', following.length);
    console.log('   Reel user:', firstReel.user.username);
    console.log('   Backend says following:', firstReel.is_following);
    console.log('   Actually in following list:', isInFollowingList);
    console.log('');

    if (firstReel.is_following !== isInFollowingList) {
      console.log('⚠️  MISMATCH: Backend state does not match following list!');
      console.log('   This means the follow relationship may not exist in the database.');
      console.log('   Solution: Follow the user from their profile page first.');
    } else {
      console.log('✅ Follow state is consistent!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFollowState();
