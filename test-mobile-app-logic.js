const fetch = require('node-fetch');

async function testMobileAppLogic() {
  try {
    console.log('🔍 Testing mobile app logic...');
    
    const baseURL = 'https://aufybackend.onrender.com';
    const username = 'its_harshit_01'; // User who has 1 reel
    
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
    
    console.log(`\n📱 Simulating mobile app logic for user: ${username}`);
    
    let allContent = [];
    
    // Step 1: Fetch posts (same as mobile app)
    console.log('\n1. Fetching posts...');
    const postsResponse = await fetch(`${baseURL}/api/users/${username}/posts`, { headers });
    console.log(`   Status: ${postsResponse.status}`);
    
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      let userPosts = postsData.data || [];
      
      // Transform posts (same as mobile app)
      userPosts = userPosts.map(post => ({
        id: post.id,
        type: post.type || 'post',
        image_url: post.image_url,
        created_at: post.created_at
      }));
      
      allContent = [...userPosts];
      console.log(`   Posts found: ${userPosts.length}`);
    }
    
    // Step 2: Fetch reels (same as mobile app)
    console.log('\n2. Fetching reels...');
    const reelsResponse = await fetch(`${baseURL}/api/reels?username=${username}`, { headers });
    console.log(`   Status: ${reelsResponse.status}`);
    
    if (reelsResponse.ok) {
      const reelsData = await reelsResponse.json();
      let userReels = reelsData.data || [];
      
      // Transform reels (same as mobile app)
      userReels = userReels.map(reel => ({
        id: reel.id,
        type: 'reel',
        image_url: reel.thumbnail_url || reel.video_url,
        created_at: reel.created_at,
        video_url: reel.video_url
      }));
      
      allContent = [...allContent, ...userReels];
      console.log(`   Reels found: ${userReels.length}`);
      
      if (userReels.length > 0) {
        console.log(`   First reel:`, {
          id: userReels[0].id,
          video_url: userReels[0].video_url,
          thumbnail: userReels[0].image_url
        });
      }
    }
    
    // Step 3: Sort and separate (same as mobile app)
    console.log('\n3. Processing combined content...');
    allContent.sort((a, b) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    
    const postsOnly = allContent.filter(item => item.type !== 'reel');
    const reelsOnly = allContent.filter(item => item.type === 'reel');
    
    console.log(`\n📊 Final Results:`);
    console.log(`   Total content: ${allContent.length}`);
    console.log(`   Posts: ${postsOnly.length}`);
    console.log(`   Reels: ${reelsOnly.length}`);
    
    if (reelsOnly.length > 0) {
      console.log(`\n🎬 Reels tab should show:`);
      reelsOnly.forEach((reel, i) => {
        console.log(`   ${i + 1}. ID: ${reel.id}, Video: ${reel.video_url}`);
      });
    } else {
      console.log(`\n❌ Reels tab will be empty`);
    }
    
    console.log(`\n✅ Mobile app logic test complete`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMobileAppLogic();