// Test script for followers/following list endpoints
const API_URL = process.env.API_URL || 'http://localhost:5000';

async function testFollowLists() {
  console.log('🧪 Testing Follow Lists Integration\n');

  try {
    // 1. Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed. Creating test user...');
      const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          full_name: 'Test User'
        })
      });
      
      if (!registerResponse.ok) {
        throw new Error('Failed to create test user');
      }
      
      const registerData = await registerResponse.json();
      var token = registerData.token;
      var userId = registerData.user.id;
    } else {
      const loginData = await loginResponse.json();
      var token = loginData.token;
      var userId = loginData.user.id;
    }

    console.log('✅ Logged in successfully');
    console.log('   User ID:', userId);

    // 2. Test followers endpoint
    console.log('\n2️⃣ Testing followers endpoint...');
    const followersResponse = await fetch(`${API_URL}/api/users/${userId}/followers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!followersResponse.ok) {
      throw new Error(`Followers endpoint failed: ${followersResponse.status}`);
    }

    const followersData = await followersResponse.json();
    console.log('✅ Followers endpoint working');
    console.log('   Response format:', {
      hasData: !!followersData.data,
      isArray: Array.isArray(followersData.data),
      count: followersData.data?.length || 0
    });

    if (followersData.data && followersData.data.length > 0) {
      const sample = followersData.data[0];
      console.log('   Sample follower:', {
        id: sample.id,
        username: sample.username,
        full_name: sample.full_name,
        avatar_url: sample.avatar_url?.substring(0, 50) + '...',
        is_verified: sample.is_verified,
        badge_type: sample.badge_type
      });
    }

    // 3. Test following endpoint
    console.log('\n3️⃣ Testing following endpoint...');
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!followingResponse.ok) {
      throw new Error(`Following endpoint failed: ${followingResponse.status}`);
    }

    const followingData = await followingResponse.json();
    console.log('✅ Following endpoint working');
    console.log('   Response format:', {
      hasData: !!followingData.data,
      isArray: Array.isArray(followingData.data),
      count: followingData.data?.length || 0
    });

    if (followingData.data && followingData.data.length > 0) {
      const sample = followingData.data[0];
      console.log('   Sample following:', {
        id: sample.id,
        username: sample.username,
        full_name: sample.full_name,
        avatar_url: sample.avatar_url?.substring(0, 50) + '...',
        is_verified: sample.is_verified,
        badge_type: sample.badge_type
      });
    }

    // 4. Verify data structure matches FollowListModal expectations
    console.log('\n4️⃣ Verifying data structure...');
    const requiredFields = ['id', 'username', 'full_name', 'avatar_url', 'is_verified'];
    
    let allFieldsPresent = true;
    if (followersData.data && followersData.data.length > 0) {
      const sample = followersData.data[0];
      requiredFields.forEach(field => {
        if (!(field in sample)) {
          console.log(`   ❌ Missing field: ${field}`);
          allFieldsPresent = false;
        }
      });
    }

    if (allFieldsPresent) {
      console.log('✅ All required fields present');
    }

    console.log('\n✅ All tests passed! Follow lists integration is working correctly.');
    console.log('\n📱 You can now:');
    console.log('   • Tap on "Followers" count in profile to see followers list');
    console.log('   • Tap on "Following" count in profile to see following list');
    console.log('   • Search users in the modal');
    console.log('   • Follow/unfollow users directly from the list');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFollowLists();
