const fetch = require('node-fetch');

async function testReelsUsernameFix() {
  try {
    console.log('🔍 Testing reels username fix...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    
    // Register a test user to get auth token
    const testUser = {
      username: `reeltest_${Date.now()}`,
      email: `reeltest_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Reel Test User'
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
    
    // Test different users
    const testUsers = ['its_harshit_01', 'its_monu_0207', 'krinaprajapati24'];
    
    for (const username of testUsers) {
      console.log(`\n👤 Testing user: ${username}`);
      
      // Test the fixed endpoint
      const reelsResponse = await fetch(`${baseURL}/api/reels?username=${username}`, { headers });
      console.log(`   Status: ${reelsResponse.status}`);
      
      if (reelsResponse.ok) {
        const reelsData = await reelsResponse.json();
        const reelsCount = (reelsData.data || []).length;
        console.log(`   Reels found: ${reelsCount}`);
        
        if (reelsCount > 0) {
          const firstReel = reelsData.data[0];
          console.log(`   First reel:`, {
            id: firstReel.id,
            user_id: firstReel.user_id,
            username: firstReel.user?.username,
            video_url: firstReel.video_url?.substring(0, 50) + '...'
          });
          
          // Verify the reel belongs to the correct user
          if (firstReel.user?.username === username) {
            console.log(`   ✅ Reel correctly belongs to ${username}`);
          } else {
            console.log(`   ❌ ERROR: Reel belongs to ${firstReel.user?.username}, not ${username}`);
          }
        } else {
          console.log(`   ℹ️  No reels found for ${username}`);
        }
      } else {
        const errorText = await reelsResponse.text();
        console.log(`   Error: ${errorText.substring(0, 100)}`);
      }
    }
    
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReelsUsernameFix();