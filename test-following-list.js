// Test script to verify followers/following endpoints
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testFollowingList() {
  console.log('🧪 Testing Followers/Following Endpoints\n');

  try {
    // 1. Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'harvinderfsd@gmail.com',
        password: 'test123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginResponse.status);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id || loginData.user._id;
    console.log('✅ Logged in as:', loginData.user.username);
    console.log('   User ID:', userId);

    // 2. Get user's following list
    console.log('\n2️⃣ Fetching following list...');
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!followingResponse.ok) {
      console.error('❌ Following fetch failed:', followingResponse.status);
      const errorText = await followingResponse.text();
      console.error('   Error:', errorText);
      return;
    }

    const followingData = await followingResponse.json();
    console.log('✅ Following response structure:', Object.keys(followingData));
    console.log('   Response:', JSON.stringify(followingData, null, 2));
    
    if (followingData.data) {
      console.log('   Following count:', followingData.data.length);
      if (followingData.data.length > 0) {
        console.log('   First user:', followingData.data[0]);
      }
    } else if (Array.isArray(followingData)) {
      console.log('   Following count:', followingData.length);
      if (followingData.length > 0) {
        console.log('   First user:', followingData[0]);
      }
    }

    // 3. Get user's followers list
    console.log('\n3️⃣ Fetching followers list...');
    const followersResponse = await fetch(`${API_URL}/api/users/${userId}/followers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!followersResponse.ok) {
      console.error('❌ Followers fetch failed:', followersResponse.status);
      const errorText = await followersResponse.text();
      console.error('   Error:', errorText);
      return;
    }

    const followersData = await followersResponse.json();
    console.log('✅ Followers response structure:', Object.keys(followersData));
    console.log('   Response:', JSON.stringify(followersData, null, 2));
    
    if (followersData.data) {
      console.log('   Followers count:', followersData.data.length);
      if (followersData.data.length > 0) {
        console.log('   First user:', followersData.data[0]);
      }
    } else if (Array.isArray(followersData)) {
      console.log('   Followers count:', followersData.length);
      if (followersData.length > 0) {
        console.log('   First user:', followersData[0]);
      }
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFollowingList();
