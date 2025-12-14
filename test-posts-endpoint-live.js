// Test the live Render API to see if deployment is complete
const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = 'https://aufybackend.onrender.com';

async function testPostsEndpoint() {
  try {
    console.log('🔍 Testing posts endpoint on Render...\n');

    // First login to get token
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hs8339952@gmail.com',
        password: 'abc123'
      })
    });

    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginRes.status);
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Logged in as:', loginData.user.username);

    // Get posts for Its.harvinder.05
    console.log('\n2️⃣ Fetching posts for Its.harvinder.05...');
    const postsRes = await fetch(`${API_URL}/api/users/Its.harvinder.05/posts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!postsRes.ok) {
      console.error('❌ Posts fetch failed:', postsRes.status);
      return;
    }

    const postsData = await postsRes.json();
    console.log('✅ Full response:', JSON.stringify(postsData, null, 2));
    console.log('Posts count:', postsData.count);
    
    const posts = postsData.posts || postsData.data || [];
    if (posts.length > 0) {
      console.log('\n📊 First post structure:');
      const firstPost = posts[0];
      console.log('ID:', firstPost.id);
      console.log('image_url:', firstPost.image_url ? '✅ EXISTS' : '❌ MISSING');
      console.log('type:', firstPost.type || '❌ MISSING');
      console.log('media_urls:', firstPost.media_urls?.length || 0, 'items');
      console.log('\nFull post:', JSON.stringify(firstPost, null, 2));
    } else {
      console.log('⚠️  No posts found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPostsEndpoint();
