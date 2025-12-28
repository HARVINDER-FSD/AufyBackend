const fetch = require('node-fetch');

async function testAllEndpoints() {
  try {
    console.log('🔍 Testing all possible endpoints...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    const username = 'its_harshit_01';
    
    // Register a test user to get auth token
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Test User'
    };
    
    const registerResponse = await fetch(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    let token = null;
    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      token = registerData.token;
      console.log('✅ Got auth token');
    }
    
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    // Test different endpoint variations
    const endpoints = [
      `/api/users/${username}/posts`,
      `/api/users/${username}`,
      `/api/posts?user=${username}`,
      `/api/posts?username=${username}`,
      `/api/reels?user=${username}`,
      `/api/reels?username=${username}`,
      `/api/feed/${username}`,
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Testing: ${endpoint}`);
      try {
        const response = await fetch(`${baseURL}${endpoint}`, { headers });
        console.log(`   Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
          
          // Check for posts/reels data
          if (data.posts && Array.isArray(data.posts)) {
            console.log(`   Posts array length: ${data.posts.length}`);
          }
          if (data.data && Array.isArray(data.data)) {
            console.log(`   Data array length: ${data.data.length}`);
          }
          if (data.reels && Array.isArray(data.reels)) {
            console.log(`   Reels array length: ${data.reels.length}`);
          }
          
          // Show first item if exists
          const items = data.posts || data.data || data.reels || [];
          if (items.length > 0) {
            console.log(`   First item keys: ${Object.keys(items[0]).join(', ')}`);
            if (items[0].type) {
              console.log(`   First item type: ${items[0].type}`);
            }
          }
        } else {
          const errorText = await response.text();
          console.log(`   Error: ${errorText.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAllEndpoints();