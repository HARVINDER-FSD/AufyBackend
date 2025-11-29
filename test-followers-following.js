const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testFollowersFollowing() {
  console.log('🔍 Testing Followers/Following Functionality\n');
  
  // Step 1: Create two test users
  console.log('1️⃣ Creating test users...');
  const user1 = {
    email: 'user1_' + Date.now() + '@test.com',
    username: 'user1_' + Date.now(),
    password: 'Test123!',
    name: 'User One'
  };
  
  const user2 = {
    email: 'user2_' + Date.now() + '@test.com',
    username: 'user2_' + Date.now(),
    password: 'Test123!',
    name: 'User Two'
  };
  
  try {
    const reg1 = await axios.post(`${BACKEND_URL}/api/auth/register`, user1);
    const reg2 = await axios.post(`${BACKEND_URL}/api/auth/register`, user2);
    
    const token1 = reg1.data.token;
    const token2 = reg2.data.token;
    const userId1 = reg1.data.user._id;
    const userId2 = reg2.data.user._id;
    
    console.log('✅ Users created');
    console.log('   User 1:', user1.username, '(ID:', userId1, ')');
    console.log('   User 2:', user2.username, '(ID:', userId2, ')');
    
    // Step 2: User 1 follows User 2
    console.log('\n2️⃣ User 1 following User 2...');
    const followResponse = await axios.post(
      `${BACKEND_URL}/api/users/${userId2}/follow`,
      {},
      {
        headers: { Authorization: `Bearer ${token1}` },
        validateStatus: () => true
      }
    );
    
    if (followResponse.status === 200) {
      console.log('✅ Follow successful');
    } else {
      console.log('❌ Follow failed:', followResponse.data);
    }
    
    // Step 3: Check User 2's followers
    console.log('\n3️⃣ Fetching User 2 followers...');
    const followersResponse = await axios.get(
      `${BACKEND_URL}/api/users/${userId2}/followers`,
      {
        headers: { Authorization: `Bearer ${token2}` },
        validateStatus: () => true
      }
    );
    
    if (followersResponse.status === 200) {
      console.log('✅ Followers fetched successfully');
      console.log('   Count:', followersResponse.data.data?.length || 0);
      if (followersResponse.data.data?.length > 0) {
        console.log('   Followers:', followersResponse.data.data.map(f => f.username));
      } else {
        console.log('   ⚠️  No followers found (might be a database issue)');
      }
    } else {
      console.log('❌ Failed to fetch followers:', followersResponse.status);
      console.log('   Error:', followersResponse.data);
    }
    
    // Step 4: Check User 1's following
    console.log('\n4️⃣ Fetching User 1 following...');
    const followingResponse = await axios.get(
      `${BACKEND_URL}/api/users/${userId1}/following`,
      {
        headers: { Authorization: `Bearer ${token1}` },
        validateStatus: () => true
      }
    );
    
    if (followingResponse.status === 200) {
      console.log('✅ Following fetched successfully');
      console.log('   Count:', followingResponse.data.data?.length || 0);
      if (followingResponse.data.data?.length > 0) {
        console.log('   Following:', followingResponse.data.data.map(f => f.username));
      } else {
        console.log('   ⚠️  No following found (might be a database issue)');
      }
    } else {
      console.log('❌ Failed to fetch following:', followingResponse.status);
      console.log('   Error:', followingResponse.data);
    }
    
    // Step 5: Check User 2's profile
    console.log('\n5️⃣ Checking User 2 profile...');
    const profileResponse = await axios.get(
      `${BACKEND_URL}/api/users/${user2.username}`,
      {
        headers: { Authorization: `Bearer ${token1}` },
        validateStatus: () => true
      }
    );
    
    if (profileResponse.status === 200) {
      console.log('✅ Profile fetched');
      console.log('   Followers count:', profileResponse.data.followersCount);
      console.log('   Following count:', profileResponse.data.followingCount);
      console.log('   Is following:', profileResponse.data.isFollowing);
    }
    
    console.log('\n📊 Summary:');
    console.log('If followers/following counts are 0, there might be:');
    console.log('1. Database field name mismatch (followerId vs follower_id)');
    console.log('2. Follow operation not creating records properly');
    console.log('3. Query using wrong field names');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
}

testFollowersFollowing();
