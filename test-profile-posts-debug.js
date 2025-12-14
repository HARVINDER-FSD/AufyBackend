// Test script to debug profile posts visibility
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testProfilePosts() {
  try {
    console.log('🔍 Testing Profile Posts Visibility\n');
    
    // Test 1: Login as user 1
    console.log('1️⃣ Logging in as first user...');
    const login1 = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'monu@gmail.com',
      password: 'Monu@123'
    });
    const token1 = login1.data.token;
    const user1 = login1.data.user;
    console.log('✅ Logged in as:', user1.username, '(ID:', user1.id, ')');
    
    // Test 2: Get another user's profile
    console.log('\n2️⃣ Fetching another user profile...');
    const username = 'krina'; // Change this to the username you want to test
    const profileResponse = await axios.get(`${API_URL}/api/users/username/${username}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    
    const profile = profileResponse.data.data || profileResponse.data;
    console.log('📊 Profile Data:', JSON.stringify({
      username: profile.username,
      id: profile.id || profile._id,
      isFollowing: profile.isFollowing,
      isPrivate: profile.isPrivate,
      followersCount: profile.followersCount,
      postsCount: profile.posts_count,
    }, null, 2));
    
    // Test 3: Get posts for that user
    console.log('\n3️⃣ Fetching posts for:', username);
    const postsResponse = await axios.get(`${API_URL}/api/users/${username}/posts`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    
    const postsData = postsResponse.data;
    console.log('📸 Posts Response:', JSON.stringify(postsData, null, 2));
    
    const posts = postsData.data?.posts || postsData.posts || postsData.data || [];
    console.log('\n📊 Posts Summary:');
    console.log('  Total posts:', posts.length);
    console.log('  Posts:', posts.map(p => ({
      id: p.id || p._id,
      type: p.type,
      caption: p.caption?.substring(0, 30),
    })));
    
    // Test 4: Check follow status
    console.log('\n4️⃣ Checking follow relationship...');
    const followCheckResponse = await axios.get(`${API_URL}/api/users/${profile.id || profile._id}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const followData = followCheckResponse.data.data || followCheckResponse.data;
    console.log('🔗 Follow Status:', {
      isFollowing: followData.isFollowing,
      followsBack: followData.followsBack,
      isMutualFollow: followData.isMutualFollow,
    });
    
    console.log('\n✅ Test Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testProfilePosts();
