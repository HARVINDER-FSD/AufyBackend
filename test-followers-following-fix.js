// Test followers/following endpoints
const API_URL = 'http://localhost:5001';

async function testFollowersFollowing() {
  console.log('🧪 Testing Followers/Following Endpoints...\n');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'private.test@example.com',
        password: 'Test123!'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log(`✅ Logged in as: ${loginData.user.username} (${userId})`);

    // Step 2: Get user profile to see counts
    console.log('\nStep 2: Getting user profile...');
    const profileResponse = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log(`✅ Profile:`, {
        username: profile.username,
        followers: profile.followers_count || profile.followers || 0,
        following: profile.following_count || profile.following || 0
      });
    }

    // Step 3: Test followers endpoint
    console.log('\nStep 3: Testing followers endpoint...');
    const followersResponse = await fetch(`${API_URL}/api/users/${userId}/followers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`Status: ${followersResponse.status} ${followersResponse.statusText}`);

    if (followersResponse.ok) {
      const followersData = await followersResponse.json();
      const followers = followersData.data || followersData || [];
      console.log(`✅ Followers endpoint returned ${followers.length} followers`);
      
      if (followers.length > 0) {
        console.log('First follower:', {
          username: followers[0].username,
          full_name: followers[0].full_name,
          id: followers[0].id
        });
      } else {
        console.log('⚠️  No followers found');
      }
    } else {
      const error = await followersResponse.text();
      console.error('❌ Followers endpoint failed:', error);
    }

    // Step 4: Test following endpoint
    console.log('\nStep 4: Testing following endpoint...');
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`Status: ${followingResponse.status} ${followingResponse.statusText}`);

    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      const following = followingData.data || followingData || [];
      console.log(`✅ Following endpoint returned ${following.length} users`);
      
      if (following.length > 0) {
        console.log('First following:', {
          username: following[0].username,
          full_name: following[0].full_name,
          id: following[0].id
        });
      } else {
        console.log('⚠️  Not following anyone');
      }
    } else {
      const error = await followingResponse.text();
      console.error('❌ Following endpoint failed:', error);
    }

    // Step 5: Test with another user who has followers
    console.log('\nStep 5: Testing with another user...');
    const usersResponse = await fetch(`${API_URL}/api/users/search?q=`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (usersResponse.ok) {
      const users = await usersResponse.json();
      if (users.length > 1) {
        const otherUser = users.find(u => u.id !== userId);
        if (otherUser) {
          console.log(`Testing with user: ${otherUser.username} (${otherUser.id})`);
          
          const otherFollowersResponse = await fetch(`${API_URL}/api/users/${otherUser.id}/followers`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (otherFollowersResponse.ok) {
            const otherFollowers = await otherFollowersResponse.json();
            const followers = otherFollowers.data || otherFollowers || [];
            console.log(`✅ ${otherUser.username} has ${followers.length} followers`);
          } else {
            const error = await otherFollowersResponse.text();
            console.error(`❌ Failed to get followers:`, error);
          }
        }
      }
    }

    // Step 6: Debug endpoint
    console.log('\nStep 6: Testing debug endpoint...');
    const debugResponse = await fetch(`${API_URL}/api/users/${userId}/followers/debug`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (debugResponse.ok) {
      const debugData = await debugResponse.json();
      console.log('✅ Debug data:', {
        followRecordsCount: debugData.followRecordsCount,
        usersFoundCount: debugData.usersFoundCount,
        profileFollowersCount: debugData.userProfileFollowersCount,
        profileFollowingCount: debugData.userProfileFollowingCount
      });
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFollowersFollowing();
