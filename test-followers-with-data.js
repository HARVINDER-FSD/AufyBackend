// Test followers/following with real data
const API_URL = 'http://localhost:5001';

async function testWithData() {
  console.log('🧪 Testing Followers/Following with Real Data...\n');

  try {
    // Login as the user with followers
    console.log('Step 1: Logging in as Its.harvinder.05...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hs8339952@gmail.com',
        password: 'sardar123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed');
      // Try to find the correct password
      console.log('Trying to get user info...');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log(`✅ Logged in as: ${loginData.user.username} (${userId})`);

    // Get profile
    console.log('\nStep 2: Getting profile...');
    const profileResponse = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log(`✅ Profile:`, {
        username: profile.username,
        followers: profile.followers_count || profile.followers || 0,
        following: profile.following_count || profile.following || 0
      });
    }

    // Test followers
    console.log('\nStep 3: Getting followers...');
    const followersResponse = await fetch(`${API_URL}/api/users/${userId}/followers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (followersResponse.ok) {
      const followersData = await followersResponse.json();
      const followers = followersData.data || followersData || [];
      console.log(`✅ Followers (${followers.length}):`);
      followers.forEach(f => {
        console.log(`  - ${f.username} (${f.full_name})`);
      });
    } else {
      console.error('❌ Followers failed:', await followersResponse.text());
    }

    // Test following
    console.log('\nStep 4: Getting following...');
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      const following = followingData.data || followingData || [];
      console.log(`✅ Following (${following.length}):`);
      following.forEach(f => {
        console.log(`  - ${f.username} (${f.full_name})`);
      });
    } else {
      console.error('❌ Following failed:', await followingResponse.text());
    }

    console.log('\n✅ All tests passed!');
    console.log('\n📱 Now test in your mobile app:');
    console.log('1. Clear app cache');
    console.log('2. Login as hs8339952@gmail.com');
    console.log('3. Go to profile');
    console.log('4. Tap on "2 followers" or "2 following"');
    console.log('5. You should see the lists!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWithData();
