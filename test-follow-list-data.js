const axios = require('axios');

const API_URL = 'https://anufy-api.onrender.com';

async function testFollowListData() {
  try {
    console.log('🔍 Testing Follow List Data Structure\n');

    // Login first
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'harvinder@gmail.com',
      password: 'Harvinder@123'
    });

    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;
    console.log('✅ Logged in as:', loginResponse.data.user.username);
    console.log('   User ID:', userId);

    // Get followers list
    console.log('\n2️⃣ Fetching Followers List...');
    const followersResponse = await axios.get(`${API_URL}/api/users/${userId}/followers`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const followers = Array.isArray(followersResponse.data) ? followersResponse.data : (followersResponse.data.data || []);
    console.log(`✅ Found ${followers.length} followers`);
    
    if (followers.length > 0) {
      console.log('\n📋 First Follower Data Structure:');
      const firstFollower = followers[0];
      console.log(JSON.stringify(firstFollower, null, 2));
      
      console.log('\n🔑 Available Fields:');
      console.log('   - id:', firstFollower.id || firstFollower._id);
      console.log('   - username:', firstFollower.username);
      console.log('   - name:', firstFollower.name);
      console.log('   - avatar:', firstFollower.avatar);
      console.log('   - isFollowing:', firstFollower.isFollowing);
      console.log('   - mutualFollow:', firstFollower.mutualFollow);
    }

    // Get following list
    console.log('\n3️⃣ Fetching Following List...');
    const followingResponse = await axios.get(`${API_URL}/api/users/${userId}/following`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const following = Array.isArray(followingResponse.data) ? followingResponse.data : (followingResponse.data.data || []);
    console.log(`✅ Found ${following.length} following`);
    
    if (following.length > 0) {
      console.log('\n📋 First Following Data Structure:');
      const firstFollowing = following[0];
      console.log(JSON.stringify(firstFollowing, null, 2));
      
      console.log('\n🔑 Available Fields:');
      console.log('   - id:', firstFollowing.id || firstFollowing._id);
      console.log('   - username:', firstFollowing.username);
      console.log('   - name:', firstFollowing.name);
      console.log('   - avatar:', firstFollowing.avatar);
      console.log('   - isFollowing:', firstFollowing.isFollowing);
      console.log('   - mutualFollow:', firstFollowing.mutualFollow);
    }

    // Check mutual follows
    console.log('\n4️⃣ Checking Mutual Follows...');
    const mutualFollows = following.filter(user => {
      const userId = user.id || user._id;
      return followers.some(follower => (follower.id || follower._id) === userId);
    });
    
    console.log(`✅ Found ${mutualFollows.length} mutual follows`);
    if (mutualFollows.length > 0) {
      console.log('\n📋 Mutual Follows:');
      mutualFollows.forEach(user => {
        console.log(`   - ${user.username} (ID: ${user.id || user._id})`);
        console.log(`     Avatar: ${user.avatar || 'NO AVATAR'}`);
        console.log(`     isFollowing: ${user.isFollowing}`);
      });
    }

    // Test the /following endpoint to see what FollowContext gets
    console.log('\n5️⃣ Testing FollowContext Data (what isFollowing checks)...');
    const followContextData = await axios.get(`${API_URL}/api/users/${userId}/following`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const followingIds = (Array.isArray(followContextData.data) ? followContextData.data : (followContextData.data.data || []))
      .map(u => String(u.id || u._id || u.userId || u.user_id));
    
    console.log('✅ Following IDs in FollowContext:', followingIds);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testFollowListData();
