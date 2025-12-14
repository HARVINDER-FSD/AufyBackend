// Test krina's posts on live Render API
const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = 'https://aufybackend.onrender.com';

async function testKrinaPosts() {
  try {
    console.log('🔍 Testing krina posts endpoint on Render...\n');

    // Login as harvinder
    console.log('1️⃣ Logging in as harvinder...');
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

    // Get krina's posts
    console.log('\n2️⃣ Fetching posts for krina...');
    const postsRes = await fetch(`${API_URL}/api/users/krina/posts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Response status:', postsRes.status);

    if (!postsRes.ok) {
      const errorText = await postsRes.text();
      console.error('❌ Posts fetch failed:', postsRes.status, errorText);
      return;
    }

    const postsData = await postsRes.json();
    console.log('✅ Posts response:', JSON.stringify(postsData, null, 2));
    
    if (postsData.posts && postsData.posts.length > 0) {
      console.log('\n📊 Latest post structure:');
      const latestPost = postsData.posts[0];
      console.log('ID:', latestPost.id);
      console.log('image_url:', latestPost.image_url ? '✅ EXISTS' : '❌ MISSING');
      console.log('image_url value:', latestPost.image_url);
      console.log('type:', latestPost.type || '❌ MISSING');
      console.log('media_urls:', latestPost.media_urls?.length || 0, 'items');
      console.log('media_type:', latestPost.media_type);
      
      console.log('\n🔍 DEPLOYMENT CHECK:');
      if (latestPost.image_url && latestPost.type) {
        console.log('✅ BACKEND DEPLOYED! New fields are present');
      } else {
        console.log('⏳ BACKEND NOT DEPLOYED YET - Render is still building...');
      }
    } else {
      console.log('⚠️  No posts found for krina');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testKrinaPosts();
