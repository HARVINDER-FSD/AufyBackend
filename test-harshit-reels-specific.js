// Test specifically for its_harshit_01 reels to debug the issue
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testHarshitReelsSpecific() {
  console.log('🔍 Testing Harshit Reels Specifically');
  console.log('=====================================');
  
  try {
    // Test 1: Direct reels endpoint for its_harshit_01
    console.log('\n📋 Test 1: Direct Reels Endpoint');
    const reelsUrl = `${API_BASE}/api/reels?username=its_harshit_01`;
    console.log('URL:', reelsUrl);
    
    const reelsResponse = await fetch(reelsUrl);
    console.log('Status:', reelsResponse.status);
    
    if (reelsResponse.ok) {
      const reelsData = await reelsResponse.json();
      console.log('Response structure:', Object.keys(reelsData));
      console.log('Reels count:', reelsData.data?.length || 0);
      
      if (reelsData.data && reelsData.data.length > 0) {
        console.log('\n📊 Reel Details:');
        reelsData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description,
            user: reel.user?.username,
            video_url: reel.video_url ? 'Present' : 'Missing',
            thumbnail_url: reel.thumbnail_url ? 'Present' : 'Missing',
            created_at: reel.created_at
          });
        });
      } else {
        console.log('❌ No reels found in response');
      }
    } else {
      const errorText = await reelsResponse.text();
      console.log('❌ Error:', errorText);
    }
    
    // Test 2: Posts endpoint (might contain reels)
    console.log('\n📋 Test 2: Posts Endpoint');
    const postsUrl = `${API_BASE}/api/users/its_harshit_01/posts`;
    console.log('URL:', postsUrl);
    
    const postsResponse = await fetch(postsUrl);
    console.log('Status:', postsResponse.status);
    
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      console.log('Posts count:', postsData.posts?.length || 0);
      
      if (postsData.posts && postsData.posts.length > 0) {
        console.log('\n📊 Post Types:');
        const postTypes = {};
        postsData.posts.forEach(post => {
          const type = post.type || post.media_type || 'unknown';
          postTypes[type] = (postTypes[type] || 0) + 1;
        });
        console.log('Post type breakdown:', postTypes);
        
        // Check for video posts that might be reels
        const videoPosts = postsData.posts.filter(p => 
          p.type === 'reel' || 
          p.media_type === 'video' || 
          (p.media_urls && p.media_urls[0] && p.media_urls[0].includes('.mp4'))
        );
        
        if (videoPosts.length > 0) {
          console.log('\n📊 Video/Reel Posts Found:', videoPosts.length);
          videoPosts.forEach((post, index) => {
            console.log(`Video Post ${index + 1}:`, {
              id: post.id,
              type: post.type,
              media_type: post.media_type,
              content: post.content?.substring(0, 50) + '...',
              user: post.user?.username,
              media_urls: post.media_urls?.length || 0
            });
          });
        } else {
          console.log('ℹ️ No video/reel posts found');
        }
      } else {
        console.log('❌ No posts found');
      }
    } else {
      const errorText = await postsResponse.text();
      console.log('❌ Posts Error:', errorText);
    }
    
    // Test 3: Check user profile
    console.log('\n📋 Test 3: User Profile');
    const profileUrl = `${API_BASE}/api/users/username/its_harshit_01`;
    console.log('URL:', profileUrl);
    
    const profileResponse = await fetch(profileUrl);
    console.log('Status:', profileResponse.status);
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const user = profileData.data || profileData;
      console.log('User found:', {
        id: user.id,
        username: user.username,
        posts_count: user.posts_count || 0,
        followers_count: user.followers_count || user.followersCount || 0,
        following_count: user.following_count || user.followingCount || 0
      });
    } else {
      const errorText = await profileResponse.text();
      console.log('❌ Profile Error:', errorText);
    }
    
    console.log('\n🏁 Harshit Reels Test Complete');
    console.log('===============================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testHarshitReelsSpecific();