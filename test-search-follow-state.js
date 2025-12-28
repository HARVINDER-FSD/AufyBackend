const axios = require('axios');

const API_URL = 'https://aufybackend.onrender.com';

async function testSearchFollowState() {
  try {
    console.log('🔐 Step 1: Login to get token...');
    
    // Login with your credentials
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'Its.harvinder.05',
      password: 'your_password_here' // Replace with actual password
    });

    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully');
    console.log('User ID:', loginResponse.data.user.id);

    console.log('\n🔍 Step 2: Search for a user you follow...');
    
    // Search for a user (replace with someone you follow)
    const searchQuery = 'krina'; // Replace with actual username
    const searchResponse = await axios.get(
      `${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('\n📊 Search Results:');
    console.log('Total users found:', searchResponse.data.users?.length || 0);
    
    if (searchResponse.data.users && searchResponse.data.users.length > 0) {
      searchResponse.data.users.forEach((user, index) => {
        console.log(`\n👤 User ${index + 1}:`);
        console.log('  Username:', user.username);
        console.log('  ID:', user.id || user._id);
        console.log('  isFollowing:', user.isFollowing);
        console.log('  Full user object:', JSON.stringify(user, null, 2));
      });
    } else {
      console.log('❌ No users found in search results');
    }

    console.log('\n🔍 Step 3: Check your following list...');
    const followingResponse = await axios.get(
      `${API_URL}/api/users/${loginResponse.data.user.id}/following`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('\n📋 Following List:');
    console.log('Total following:', followingResponse.data.length || followingResponse.data.data?.length || 0);
    const following = Array.isArray(followingResponse.data) ? followingResponse.data : (followingResponse.data.data || []);
    following.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username || user.name} (ID: ${user.id || user._id})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('⚠️  Authentication failed. Please update the password in the script.');
    }
  }
}

testSearchFollowState();
