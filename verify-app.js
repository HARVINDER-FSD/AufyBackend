/**
 * App Verification Script
 * Tests core functionality without test framework
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001';
let testToken = '';
let testUserId = '';

async function verify() {
  console.log('\n🔍 VERIFYING ANUFY APP FUNCTIONALITY\n');
  
  try {
    // 1. Health Check
    console.log('1️⃣  Health Check...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('   ✅ Server is running:', health.data.message);
    
    // 2. Register User
    console.log('\n2️⃣  Registering User...');
    const email = `verify${Date.now()}@test.com`;
    const username = `verify${Date.now()}`;
    const registerRes = await axios.post(`${API_URL}/api/auth/register`, {
      email,
      password: 'Test@123456',
      username,
      full_name: 'Verify User'
    });
    testToken = registerRes.data.token;
    testUserId = registerRes.data.user.id;
    console.log('   ✅ User registered:', username);
    console.log('   ✅ Token received:', testToken.substring(0, 20) + '...');
    
    // 3. Get Current User
    console.log('\n3️⃣  Getting Current User...');
    const userRes = await axios.get(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    console.log('   ✅ Current user:', userRes.data.username || userRes.data.user?.username);
    console.log('   Response:', JSON.stringify(userRes.data).substring(0, 100));
    
    // 4. Update Profile
    console.log('\n4️⃣  Updating Profile...');
    const updateRes = await axios.put(`${API_URL}/api/users/profile`, {
      full_name: 'Verified User',
      bio: 'Testing the app'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    console.log('   ✅ Profile updated');
    
    // 5. Create Post
    console.log('\n5️⃣  Creating Post...');
    const postRes = await axios.post(`${API_URL}/api/posts`, {
      content: 'Testing Anufy app',
      media_urls: [],
      media_type: 'text'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const postId = postRes.data.data.post.id;
    console.log('   ✅ Post created:', postId);
    
    // 6. Get User Posts
    console.log('\n6️⃣  Getting User Posts...');
    const postsRes = await axios.get(`${API_URL}/api/users/${testUserId}/posts`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const postsCount = postsRes.data.data?.posts?.length || postsRes.data.posts?.length || 0;
    console.log('   ✅ Posts retrieved:', postsCount);
    
    // 7. Like Post
    console.log('\n7️⃣  Liking Post...');
    const likeRes = await axios.post(`${API_URL}/api/posts/${postId}/like`, {}, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    console.log('   ✅ Post liked');
    
    // 8. Comment on Post
    console.log('\n8️⃣  Commenting on Post...');
    const commentRes = await axios.post(`${API_URL}/api/posts/${postId}/comments`, {
      content: 'Great app!'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    console.log('   ✅ Comment added');
    
    // 9. Search Users
    console.log('\n9️⃣  Searching Users...');
    const searchRes = await axios.get(`${API_URL}/api/search?q=verify`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const searchCount = searchRes.data.data?.users?.length || searchRes.data.users?.length || 0;
    console.log('   ✅ Search results:', searchCount, 'users found');
    
    // 10. Get Feed
    console.log('\n🔟 Getting Feed...');
    const feedRes = await axios.get(`${API_URL}/api/posts/feed`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const feedCount = feedRes.data.data?.posts?.length || feedRes.data.posts?.length || 0;
    console.log('   ✅ Feed retrieved:', feedCount, 'posts');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL CORE FEATURES VERIFIED SUCCESSFULLY!');
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

verify();
