const fetch = require('node-fetch');

async function testUserPostsAPI() {
  try {
    // Test the user posts endpoint for the user who has reels
    const username = 'its_harshit_01'; // User who has 1 reel
    const baseURL = 'https://aufybackend.onrender.com'; // Production backend
    
    console.log(`🔍 Testing /api/users/${username}/posts endpoint...`);
    console.log(`URL: ${baseURL}/api/users/${username}/posts`);
    
    // We need a valid token - let's try without auth first
    const response = await fetch(`${baseURL}/api/users/${username}/posts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`\n📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log(`\n✅ API Response:`, JSON.stringify(data, null, 2));
      
      if (data.posts) {
        console.log(`\n📊 Analysis:`);
        console.log(`   - Total items: ${data.posts.length}`);
        console.log(`   - Posts: ${data.posts.filter(p => p.type !== 'reel').length}`);
        console.log(`   - Reels: ${data.posts.filter(p => p.type === 'reel').length}`);
        
        data.posts.forEach((item, i) => {
          console.log(`   - Item ${i + 1}: ID=${item.id}, type=${item.type}, media_type=${item.media_type}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`\n❌ API Error:`, errorText);
      
      if (response.status === 401) {
        console.log('\n🔐 Authentication required. This is expected for private endpoints.');
        console.log('The backend is working, but requires authentication.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testUserPostsAPI();