const fetch = require('node-fetch');

async function testProductionReelsEndpoint() {
  try {
    console.log('🔍 Testing production reels endpoint...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    
    // Register a test user to get auth token
    const testUser = {
      username: `prodtest_${Date.now()}`,
      email: `prodtest_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Production Test User'
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
    
    console.log('✅ Got auth token');
    
    // Test 1: User with reels (should return 1 reel)
    console.log('\n1. Testing user with reels: its_harshit_01');
    const harshitReelsResponse = await fetch(`${baseURL}/api/reels?username=its_harshit_01`, { headers });
    console.log(`   Status: ${harshitReelsResponse.status}`);
    
    if (harshitReelsResponse.ok) {
      const harshitReelsData = await harshitReelsResponse.json();
      const reelsCount = (harshitReelsData.data || []).length;
      console.log(`   Reels found: ${reelsCount}`);
      
      if (reelsCount === 1) {
        const reel = harshitReelsData.data[0];
        if (reel.user?.username === 'its_harshit_01') {
          console.log(`   ✅ Correct: 1 reel belonging to its_harshit_01`);
        } else {
          console.log(`   ❌ Wrong user: reel belongs to ${reel.user?.username}`);
        }
      } else {
        console.log(`   ❌ Wrong count: expected 1, got ${reelsCount}`);
      }
    } else {
      const errorText = await harshitReelsResponse.text();
      console.log(`   Error: ${errorText.substring(0, 100)}`);
    }
    
    // Test 2: User without reels (should return 0 reels)
    console.log('\n2. Testing user without reels: its_monu_0207');
    const monuReelsResponse = await fetch(`${baseURL}/api/reels?username=its_monu_0207`, { headers });
    console.log(`   Status: ${monuReelsResponse.status}`);
    
    if (monuReelsResponse.ok) {
      const monuReelsData = await monuReelsResponse.json();
      const reelsCount = (monuReelsData.data || []).length;
      console.log(`   Reels found: ${reelsCount}`);
      
      if (reelsCount === 0) {
        console.log(`   ✅ Correct: 0 reels for its_monu_0207`);
      } else {
        console.log(`   ❌ Wrong: expected 0 reels, got ${reelsCount}`);
        if (reelsCount > 0) {
          const reel = monuReelsData.data[0];
          console.log(`   First reel belongs to: ${reel.user?.username}`);
        }
      }
    } else {
      const errorText = await monuReelsResponse.text();
      console.log(`   Error: ${errorText.substring(0, 100)}`);
    }
    
    // Test 3: Non-existent user (should return 404)
    console.log('\n3. Testing non-existent user: nonexistent_user');
    const nonExistentResponse = await fetch(`${baseURL}/api/reels?username=nonexistent_user`, { headers });
    console.log(`   Status: ${nonExistentResponse.status}`);
    
    if (nonExistentResponse.status === 404) {
      console.log(`   ✅ Correct: 404 for non-existent user`);
    } else {
      console.log(`   ❌ Wrong status: expected 404, got ${nonExistentResponse.status}`);
    }
    
    console.log('\n✅ Production test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProductionReelsEndpoint();