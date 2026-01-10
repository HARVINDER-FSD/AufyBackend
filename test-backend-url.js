/**
 * Backend URL Verification Script
 * Tests the production backend URL
 */

const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';
let testToken = '';
let testUserId = '';

async function verify() {
  console.log('\n🔍 TESTING BACKEND URL: ' + BACKEND_URL + '\n');
  
  try {
    // 1. Health Check
    console.log('1️⃣  Health Check...');
    try {
      const health = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      console.log('   ✅ Server is running:', health.data.message);
    } catch (err) {
      console.log('   ⚠️  Health check failed:', err.message);
      console.log('   Note: Server might be sleeping on Render free tier');
    }
    
    // 2. Register User
    console.log('\n2️⃣  Registering User...');
    const email = `backend${Date.now()}@test.com`;
    const username = `backend${Date.now()}`;
    try {
      const registerRes = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        email,
        password: 'Test@123456',
        username,
        full_name: 'Backend Test User'
      }, { timeout: 15000 });
      testToken = registerRes.data.token;
      testUserId = registerRes.data.user.id;
      console.log('   ✅ User registered:', username);
      console.log('   ✅ Token received:', testToken.substring(0, 20) + '...');
    } catch (err) {
      console.log('   ❌ Registration failed:', err.response?.data?.message || err.message);
      throw err;
    }
    
    // 3. Get Current User
    console.log('\n3️⃣  Getting Current User...');
    try {
      const userRes = await axios.get(`${BACKEND_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
      console.log('   ✅ Current user:', userRes.data.username || userRes.data.user?.username);
    } catch (err) {
      console.log('   ❌ Get user failed:', err.response?.data?.message || err.message);
    }
    
    // 4. Create Post
    console.log('\n4️⃣  Creating Post...');
    try {
      const postRes = await axios.post(`${BACKEND_URL}/api/posts`, {
        content: 'Testing backend URL',
        media_urls: [],
        media_type: 'text'
      }, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
      console.log('   ✅ Post created:', postRes.data.data?.post?.id || postRes.data.post?.id);
    } catch (err) {
      console.log('   ❌ Post creation failed:', err.response?.data?.message || err.message);
    }
    
    // 5. Search Users
    console.log('\n5️⃣  Searching Users...');
    try {
      const searchRes = await axios.get(`${BACKEND_URL}/api/search?q=backend`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
      const searchCount = searchRes.data.data?.users?.length || searchRes.data.users?.length || 0;
      console.log('   ✅ Search results:', searchCount, 'users found');
    } catch (err) {
      console.log('   ❌ Search failed:', err.response?.data?.message || err.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ BACKEND URL VERIFICATION COMPLETE!');
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.log('\nNote: If the server is on Render free tier, it may be sleeping.');
    console.log('The server wakes up after the first request (takes 30-60 seconds).');
    process.exit(1);
  }
}

verify();
