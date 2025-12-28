const fetch = require('node-fetch');

async function testProductionBackend() {
  try {
    console.log('🔍 Testing production backend...');
    
    // Test 1: Health check
    console.log('\n1. Health Check:');
    const healthResponse = await fetch('https://aufybackend.onrender.com/health');
    console.log(`   Status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.text();
      console.log(`   Response: ${healthData}`);
    }
    
    // Test 2: Try to get user posts for the user who has reels
    console.log('\n2. User Posts API (without auth):');
    const postsResponse = await fetch('https://aufybackend.onrender.com/api/users/its_harshit_01/posts');
    console.log(`   Status: ${postsResponse.status}`);
    
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      console.log(`   Response:`, JSON.stringify(postsData, null, 2));
    } else {
      const errorText = await postsResponse.text();
      console.log(`   Error: ${errorText}`);
    }
    
    // Test 3: Try to register a test user to get a token
    console.log('\n3. Register Test User:');
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Test User'
    };
    
    const registerResponse = await fetch('https://aufybackend.onrender.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    console.log(`   Status: ${registerResponse.status}`);
    
    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      console.log(`   Registration successful!`);
      
      const token = registerData.token;
      if (token) {
        console.log('\n4. User Posts API (with auth):');
        const authPostsResponse = await fetch('https://aufybackend.onrender.com/api/users/its_harshit_01/posts', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`   Status: ${authPostsResponse.status}`);
        
        if (authPostsResponse.ok) {
          const authPostsData = await authPostsResponse.json();
          console.log(`   Response:`, JSON.stringify(authPostsData, null, 2));
          
          if (authPostsData.posts) {
            console.log(`\n📊 Analysis:`);
            console.log(`   - Total items: ${authPostsData.posts.length}`);
            console.log(`   - Posts: ${authPostsData.posts.filter(p => p.type !== 'reel').length}`);
            console.log(`   - Reels: ${authPostsData.posts.filter(p => p.type === 'reel').length}`);
          }
        } else {
          const authErrorText = await authPostsResponse.text();
          console.log(`   Error: ${authErrorText}`);
        }
      }
    } else {
      const registerErrorText = await registerResponse.text();
      console.log(`   Error: ${registerErrorText}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProductionBackend();