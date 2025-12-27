// Test complete follow fix - both endpoints
require('dotenv').config({ path: __dirname + '/.env' });

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';
const TEST_EMAIL = 'hs8339952@gmail.com';
const TEST_PASSWORD = 'abc123';

async function testCompleteFix() {
  console.log('🧪 Testing Complete Follow Fix\n');
  console.log('API URL:', API_URL);
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
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, `(${userId})`);
    console.log('');

    // 2. Test /following endpoint
    console.log('2️⃣ Testing /following endpoint...');
    const followingRes = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!followingRes.ok) {
      console.error('❌ Following endpoint failed:', followingRes.status);
      const errorText = await followingRes.text();
      console.error('Error:', errorText);
    } else {
      const followingData = await followingRes.json();
      console.log('✅ Following endpoint response:', JSON.stringify(followingData, null, 2));
      
      const following = Array.isArray(followingData) ? followingData : (followingData.data || []);
      console.log(`\n📊 Following count: ${following.length}`);
      
      if (following.length > 0) {
        console.log('\n👥 Following users:');
        following.forEach((user, i) => {
          console.log(`   ${i + 1}. ${user.username} (${user.id})`);
        });
      } else {
        console.log('⚠️  Not following anyone!');
      }
    }
    console.log('');

    // 3. Test /reels endpoint with auth
    console.log('3️⃣ Testing /reels endpoint with auth...');
    const reelsRes = await fetch(`${API_URL}/api/reels`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!reelsRes.ok) {
      console.error('❌ Reels endpoint failed:', reelsRes.status);
    } else {
      const reelsData = await reelsRes.json();
      const reels = Array.isArray(reelsData) ? reelsData : (reelsData.data || reelsData.reels || []);
      
      console.log(`✅ Reels endpoint returned ${reels.length} reels`);
      
      if (reels.length > 0) {
        const firstReel = reels[0];
        console.log('\n📹 First reel:');
        console.log('   User:', firstReel.user?.username, `(${firstReel.user?.id})`);
        console.log('   is_following:', firstReel.is_following);
        console.log('   user.is_following:', firstReel.user?.is_following);
      }
    }
    console.log('');

    // 4. Summary
    console.log('📊 SUMMARY:');
    console.log('   Backend deployed: Check Render dashboard');
    console.log('   Following endpoint: ' + (followingRes.ok ? '✅ Working' : '❌ Failed'));
    console.log('   Reels endpoint: ' + (reelsRes.ok ? '✅ Working' : '❌ Failed'));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCompleteFix();
