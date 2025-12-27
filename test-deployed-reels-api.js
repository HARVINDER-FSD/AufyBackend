// Test the deployed backend reels API
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';
const EMAIL = 'hs8339952@gmail.com';
const PASSWORD = 'abc123';

async function testDeployedReelsAPI() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, '(ID:', userId, ')');

    // Get reels with auth
    console.log('\n📹 Fetching reels with authentication...');
    const reelsResponse = await fetch(`${API_URL}/api/reels`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!reelsResponse.ok) {
      console.error('❌ Reels fetch failed:', await reelsResponse.text());
      return;
    }

    const reelsData = await reelsResponse.json();
    const reels = reelsData.data?.reels || reelsData.reels || reelsData.data || [];
    
    console.log(`✅ Got ${reels.length} reels\n`);

    // Check each reel's follow state
    reels.forEach((reel, index) => {
      console.log(`Reel ${index + 1}:`);
      console.log(`  Username: ${reel.user?.username || 'unknown'}`);
      console.log(`  User ID: ${reel.user?.id || reel.user?._id || 'unknown'}`);
      console.log(`  is_following (reel level): ${reel.is_following}`);
      console.log(`  is_following (user level): ${reel.user?.is_following}`);
      console.log(`  Caption: ${(reel.description || reel.caption || '').substring(0, 50)}...`);
      console.log('');
    });

    // Get following list to compare
    console.log('📋 Getting following list for comparison...');
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      const following = Array.isArray(followingData) ? followingData : (followingData.data || []);
      console.log(`✅ You are following ${following.length} users:`);
      following.forEach(u => {
        console.log(`   - ${u.username} (ID: ${u.id || u._id})`);
      });

      // Check if reel creators are in following list
      console.log('\n🔍 Cross-checking reel creators with following list:');
      reels.forEach((reel, index) => {
        const reelUserId = reel.user?.id || reel.user?._id;
        const isInFollowingList = following.some(f => (f.id || f._id) === reelUserId);
        const backendSaysFollowing = reel.is_following || reel.user?.is_following;
        
        console.log(`Reel ${index + 1} (${reel.user?.username}):`);
        console.log(`  In following list: ${isInFollowingList}`);
        console.log(`  Backend says following: ${backendSaysFollowing}`);
        console.log(`  Match: ${isInFollowingList === backendSaysFollowing ? '✅' : '❌'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDeployedReelsAPI();
