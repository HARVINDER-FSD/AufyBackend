const fetch = require('node-fetch');

async function testMobileAppURL() {
  try {
    console.log('🔍 Testing which URL the mobile app should be using...');
    
    // Test both URLs to see which one has the reels data
    const urls = [
      'https://aufybackend.onrender.com', // Direct backend
      'https://hs8339952.workers.dev'     // CloudFlare Worker
    ];
    
    const testUsername = 'its_harshit_01';
    
    // Register a test user to get auth token
    const testUser = {
      username: `urltest_${Date.now()}`,
      email: `urltest_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'URL Test User'
    };
    
    for (const baseURL of urls) {
      console.log(`\n🌐 Testing: ${baseURL}`);
      
      try {
        // Try to register
        const registerResponse = await fetch(`${baseURL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testUser)
        });
        
        console.log(`   Registration status: ${registerResponse.status}`);
        
        if (!registerResponse.ok) {
          console.log(`   Registration failed, skipping...`);
          continue;
        }
        
        const registerData = await registerResponse.json();
        const token = registerData.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Test reels endpoint
        const reelsResponse = await fetch(`${baseURL}/api/reels?username=${testUsername}`, { headers });
        console.log(`   Reels endpoint status: ${reelsResponse.status}`);
        
        if (reelsResponse.ok) {
          const reelsData = await reelsResponse.json();
          const reelsCount = (reelsData.data || []).length;
          console.log(`   Reels found: ${reelsCount}`);
          
          if (reelsCount > 0) {
            console.log(`   ✅ This URL has reel data!`);
          } else {
            console.log(`   ❌ No reels found on this URL`);
          }
        } else {
          console.log(`   ❌ Reels endpoint failed`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error testing ${baseURL}:`, error.message);
      }
    }
    
    console.log('\n📱 Mobile app should use: https://aufybackend.onrender.com');
    console.log('💡 If mobile app is using CloudFlare Worker, it needs to be updated or rebuilt');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMobileAppURL();