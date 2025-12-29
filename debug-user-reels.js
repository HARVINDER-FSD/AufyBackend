const fetch = require('node-fetch');

async function debugUserReels() {
  try {
    console.log('🔍 Debugging user reels issue...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    
    // Register a test user to get auth token
    const testUser = {
      username: `debugtest_${Date.now()}`,
      email: `debugtest_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Debug Test User'
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
    
    console.log('✅ Got auth token for test user:', testUser.username);
    
    // Test 1: Get reels for user who has reels (its_harshit_01)
    console.log('\n1. Testing reels for user with reels: its_harshit_01');
    const harshitReelsResponse = await fetch(`${baseURL}/api/reels?username=its_harshit_01`, { headers });
    console.log(`   Status: ${harshitReelsResponse.status}`);
    
    if (harshitReelsResponse.ok) {
      const harshitReelsData = await harshitReelsResponse.json();
      const reels = harshitReelsData.data || [];
      console.log(`   Reels found: ${reels.length}`);
      
      if (reels.length > 0) {
        reels.forEach((reel, i) => {
          console.log(`   Reel ${i + 1}:`);
          console.log(`     - ID: ${reel.id}`);
          console.log(`     - User ID: ${reel.user_id}`);
          console.log(`     - Username: ${reel.user?.username}`);
          console.log(`     - Video URL: ${reel.video_url}`);
        });
        
        // Check if any reel belongs to a different user
        const wrongUserReels = reels.filter(reel => reel.user?.username !== 'its_harshit_01');
        if (wrongUserReels.length > 0) {
          console.log(`   ❌ PROBLEM: ${wrongUserReels.length} reels belong to other users!`);
          wrongUserReels.forEach((reel, i) => {
            console.log(`     Wrong reel ${i + 1}: belongs to ${reel.user?.username}`);
          });
        } else {
          console.log(`   ✅ All reels correctly belong to its_harshit_01`);
        }
      }
    } else {
      const errorText = await harshitReelsResponse.text();
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
    
    // Test 2: Get reels for test user (should be empty)
    console.log(`\n2. Testing reels for test user: ${testUser.username}`);
    const testUserReelsResponse = await fetch(`${baseURL}/api/reels?username=${testUser.username}`, { headers });
    console.log(`   Status: ${testUserReelsResponse.status}`);
    
    if (testUserReelsResponse.ok) {
      const testUserReelsData = await testUserReelsResponse.json();
      const reels = testUserReelsData.data || [];
      console.log(`   Reels found: ${reels.length}`);
      
      if (reels.length > 0) {
        console.log(`   ❌ PROBLEM: Test user has reels when they shouldn't!`);
        reels.forEach((reel, i) => {
          console.log(`     Reel ${i + 1}: belongs to ${reel.user?.username}`);
        });
      } else {
        console.log(`   ✅ Correct: Test user has no reels`);
      }
    } else {
      const errorText = await testUserReelsResponse.text();
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
    
    // Test 3: Get reels for user without reels (its_monu_0207)
    console.log('\n3. Testing reels for user without reels: its_monu_0207');
    const monuReelsResponse = await fetch(`${baseURL}/api/reels?username=its_monu_0207`, { headers });
    console.log(`   Status: ${monuReelsResponse.status}`);
    
    if (monuReelsResponse.ok) {
      const monuReelsData = await monuReelsResponse.json();
      const reels = monuReelsData.data || [];
      console.log(`   Reels found: ${reels.length}`);
      
      if (reels.length > 0) {
        console.log(`   ❌ PROBLEM: User without reels has reels!`);
        reels.forEach((reel, i) => {
          console.log(`     Reel ${i + 1}: belongs to ${reel.user?.username}`);
        });
      } else {
        console.log(`   ✅ Correct: User has no reels`);
      }
    } else {
      const errorText = await monuReelsResponse.text();
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
    
    console.log('\n✅ Debug test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugUserReels();