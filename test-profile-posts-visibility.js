// Test script to check if profile posts are visible
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:5000';

async function testProfilePostsVisibility() {
  console.log('🧪 Testing Profile Posts Visibility...\n');

  try {
    // Step 1: Login as user1
    console.log('1️⃣ Logging in as user1...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user1@test.com',
        password: 'password123'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Logged in successfully\n');

    // Step 2: Get user2's profile
    console.log('2️⃣ Fetching user2 profile...');
    const profileRes = await fetch(`${API_URL}/api/users/username/user2`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.status}`);
    }

    const profileData = await profileRes.json();
    console.log('Profile Data:');
    console.log('  Username:', profileData.username);
    console.log('  Is Private:', profileData.isPrivate || profileData.is_private);
    console.log('  Is Following:', profileData.isFollowing || profileData.is_following);
    console.log('  Posts Count:', profileData.posts_count);
    console.log('');

    // Step 3: Get user2's posts
    console.log('3️⃣ Fetching user2 posts...');
    const postsRes = await fetch(`${API_URL}/api/users/user2/posts`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!postsRes.ok) {
      console.log(`❌ Posts fetch failed: ${postsRes.status}`);
      const errorText = await postsRes.text();
      console.log('Error:', errorText);
    } else {
      const postsData = await postsRes.json();
      console.log('✅ Posts fetched successfully');
      console.log('  Posts returned:', postsData.posts?.length || 0);
      console.log('  Message:', postsData.message || 'None');
      
      if (postsData.posts && postsData.posts.length > 0) {
        console.log('\n  First post:');
        console.log('    ID:', postsData.posts[0].id);
        console.log('    Caption:', postsData.posts[0].caption?.substring(0, 50));
        console.log('    Media Type:', postsData.posts[0].media_type);
      }
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testProfilePostsVisibility();
