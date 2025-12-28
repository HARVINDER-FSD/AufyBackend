const fetch = require('node-fetch');

async function debugSpecificUser() {
  try {
    console.log('🔍 Debugging specific user reel issue...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    
    // Test with the user who has reels
    const testUsername = 'its_harshit_01';
    
    console.log(`\n👤 Testing user: ${testUsername}`);
    
    // Step 1: Register a test user to get auth token
    const testUser = {
      username: `debuguser_${Date.now()}`,
      email: `debug_${Date.now()}@example.com`,
      password: 'testpass123',
      full_name: 'Debug User'
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
      console.log('✅ Got auth token for testing');
    } else {
      console.log('❌ Failed to get auth token');
      return;
    }
    
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Step 2: Test the exact API calls the mobile app makes
    console.log('\n📱 Testing mobile app API calls...');
    
    // Call 1: Posts endpoint
    console.log('\n1. Posts endpoint:');
    const postsResponse = await fetch(`${baseURL}/api/users/${testUsername}/posts`, { headers });
    console.log(`   Status: ${postsResponse.status}`);
    
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      console.log(`   Response structure:`, Object.keys(postsData));
      console.log(`   Posts data:`, postsData.data || postsData.posts || 'No posts data');
      console.log(`   Posts count:`, (postsData.data || postsData.posts || []).length);
    } else {
      const errorText = await postsResponse.text();
      console.log(`   Error:`, errorText.substring(0, 200));
    }
    
    // Call 2: Reels endpoint
    console.log('\n2. Reels endpoint:');
    const reelsResponse = await fetch(`${baseURL}/api/reels?username=${testUsername}`, { headers });
    console.log(`   Status: ${reelsResponse.status}`);
    
    if (reelsResponse.ok) {
      const reelsData = await reelsResponse.json();
      console.log(`   Response structure:`, Object.keys(reelsData));
      console.log(`   Reels data count:`, (reelsData.data || []).length);
      
      if (reelsData.data && reelsData.data.length > 0) {
        console.log(`   First reel:`, {
          id: reelsData.data[0].id,
          video_url: reelsData.data[0].video_url,
          thumbnail_url: reelsData.data[0].thumbnail_url,
          user: reelsData.data[0].user ? {
            id: reelsData.data[0].user.id,
            username: reelsData.data[0].user.username
          } : 'No user data'
        });
      }
    } else {
      const errorText = await reelsResponse.text();
      console.log(`   Error:`, errorText.substring(0, 200));
    }
    
    // Step 3: Test if the issue is with the current user's own profile
    console.log('\n3. Testing current user profile access...');
    
    // Get current user info
    const meResponse = await fetch(`${baseURL}/api/users/me`, { headers });
    if (meResponse.ok) {
      const meData = await meResponse.json();
      const currentUsername = meData.username;
      console.log(`   Current user: ${currentUsername}`);
      
      // Test current user's reels
      const myReelsResponse = await fetch(`${baseURL}/api/reels?username=${currentUsername}`, { headers });
      console.log(`   My reels status: ${myReelsResponse.status}`);
      
      if (myReelsResponse.ok) {
        const myReelsData = await myReelsResponse.json();
        console.log(`   My reels count: ${(myReelsData.data || []).length}`);
      }
    }
    
    // Step 4: Test different users to see if any have reels
    console.log('\n4. Testing other users with reels...');
    
    const testUsers = ['its_harshit_01', 'its_monu_0207', 'krinaprajapati24'];
    
    for (const username of testUsers) {
      const userReelsResponse = await fetch(`${baseURL}/api/reels?username=${username}`, { headers });
      if (userReelsResponse.ok) {
        const userReelsData = await userReelsResponse.json();
        const reelsCount = (userReelsData.data || []).length;
        console.log(`   ${username}: ${reelsCount} reels`);
        
        if (reelsCount > 0) {
          console.log(`     First reel ID: ${userReelsData.data[0].id}`);
        }
      }
    }
    
    console.log('\n✅ Debug complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugSpecificUser();