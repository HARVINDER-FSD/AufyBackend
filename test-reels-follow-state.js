const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';

async function testReelsFollowState() {
  try {
    console.log('🧪 Testing Reels Follow State\n');

    // Step 1: Login as the user who should see follow state
    console.log('1️⃣ Logging in as user...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hs8339952@gmail.com',
        password: 'abc123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginResponse.status);
      const error = await loginResponse.text();
      console.error('Error:', error);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, '(ID:', userId, ')');

    // Step 2: Get following list
    console.log('\n2️⃣ Getting following list...');
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      const following = Array.isArray(followingData) ? followingData : (followingData.data || []);
      console.log('✅ Following', following.length, 'users:');
      following.forEach(u => {
        console.log(`   - ${u.username} (ID: ${u.id || u._id})`);
      });
    } else {
      console.log('⚠️ Could not fetch following list');
    }

    // Step 3: Get reels feed WITH authentication
    console.log('\n3️⃣ Getting reels feed WITH auth token...');
    const reelsResponse = await fetch(`${API_URL}/api/reels`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!reelsResponse.ok) {
      console.error('❌ Reels fetch failed:', reelsResponse.status);
      const error = await reelsResponse.text();
      console.error('Error:', error);
      return;
    }

    const reelsData = await reelsResponse.json();
    const reels = reelsData.data?.reels || reelsData.reels || reelsData.data || [];
    
    console.log('✅ Got', reels.length, 'reels\n');

    // Step 4: Check follow state for each reel
    console.log('4️⃣ Checking follow state for each reel:');
    reels.forEach((reel, index) => {
      console.log(`\nReel ${index + 1}:`);
      console.log(`  Username: ${reel.user?.username || 'unknown'}`);
      console.log(`  User ID: ${reel.user?.id || reel.user?._id || 'unknown'}`);
      console.log(`  is_following (reel level): ${reel.is_following}`);
      console.log(`  is_following (user level): ${reel.user?.is_following}`);
      
      if (reel.is_following || reel.user?.is_following) {
        console.log('  ✅ FOLLOWING - Button should show "Following"');
      } else {
        console.log('  ❌ NOT FOLLOWING - Button should show "Follow"');
      }
    });

    // Step 5: Get reels feed WITHOUT authentication
    console.log('\n\n5️⃣ Getting reels feed WITHOUT auth token (for comparison)...');
    const reelsNoAuthResponse = await fetch(`${API_URL}/api/reels`);

    if (reelsNoAuthResponse.ok) {
      const reelsNoAuthData = await reelsNoAuthResponse.json();
      const reelsNoAuth = reelsNoAuthData.data?.reels || reelsNoAuthData.reels || reelsNoAuthData.data || [];
      
      console.log('✅ Got', reelsNoAuth.length, 'reels without auth');
      console.log('First reel follow state:', reelsNoAuth[0]?.is_following || 'undefined');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReelsFollowState();
