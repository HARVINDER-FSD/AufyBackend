const fetch = require('node-fetch');

async function testMobileAppURL() {
  try {
    console.log('🔍 Testing mobile app URL construction...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    
    // Test 1: Login as a real user to get their token
    console.log('\n1. Testing login and user data...');
    
    // Try to login with a known user (you'll need to provide real credentials)
    // For now, let's register a test user and see what happens
    const testUser = {
      username: `mobiletest_${Date.now()}`,
      email: `mobiletest_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Mobile Test User'
    };
    
    const registerResponse = await fetch(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (!registerResponse.ok) {
      console.log('❌ Failed to register test user');
      return;
    }
    
    const registerData = await registerResponse.json();
    const token = registerData.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    console.log('✅ Registered and got token for:', testUser.username);
    
    // Test 2: Get user profile data (what mobile app gets)
    console.log('\n2. Getting user profile data...');
    const userResponse = await fetch(`${baseURL}/api/users/me`, { headers });
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('User data received:');
      console.log('  - ID:', userData.id);
      console.log('  - Username:', userData.username);
      console.log('  - Email:', userData.email);
      
      // Test 3: Use this user data to fetch reels (simulate mobile app)
      console.log('\n3. Fetching reels using user data...');
      const reelsURL = `${baseURL}/api/reels?username=${userData.username}`;
      console.log('Reels URL:', reelsURL);
      
      const reelsResponse = await fetch(reelsURL, { headers });
      console.log('Reels response status:', reelsResponse.status);
      
      if (reelsResponse.ok) {
        const reelsData = await reelsResponse.json();
        const reels = reelsData.data || [];
        console.log('Reels found:', reels.length);
        
        if (reels.length > 0) {
          console.log('❌ PROBLEM: New user has reels!');
          reels.forEach((reel, i) => {
            console.log(`  Reel ${i + 1}: belongs to ${reel.user?.username}`);
          });
        } else {
          console.log('✅ Correct: New user has no reels');
        }
      } else {
        const errorText = await reelsResponse.text();
        console.log('Reels error:', errorText.substring(0, 200));
      }
    } else {
      console.log('❌ Failed to get user data');
    }
    
    // Test 4: Test with the user who actually has reels
    console.log('\n4. Testing with user who has reels...');
    const harshitReelsURL = `${baseURL}/api/reels?username=its_harshit_01`;
    console.log('Harshit reels URL:', harshitReelsURL);
    
    const harshitReelsResponse = await fetch(harshitReelsURL, { headers });
    console.log('Harshit reels response status:', harshitReelsResponse.status);
    
    if (harshitReelsResponse.ok) {
      const harshitReelsData = await harshitReelsResponse.json();
      const harshitReels = harshitReelsData.data || [];
      console.log('Harshit reels found:', harshitReels.length);
      
      if (harshitReels.length > 0) {
        harshitReels.forEach((reel, i) => {
          console.log(`  Reel ${i + 1}:`);
          console.log(`    - Belongs to: ${reel.user?.username}`);
          console.log(`    - User ID: ${reel.user_id}`);
          console.log(`    - Video: ${reel.video_url?.substring(0, 50)}...`);
        });
        
        // Check if this reel would show up in other users' profiles
        const wrongUserReels = harshitReels.filter(reel => reel.user?.username !== 'its_harshit_01');
        if (wrongUserReels.length > 0) {
          console.log('❌ CRITICAL: Reels showing wrong user ownership!');
        } else {
          console.log('✅ Reels correctly show ownership');
        }
      }
    }
    
    console.log('\n✅ Mobile app URL test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMobileAppURL();