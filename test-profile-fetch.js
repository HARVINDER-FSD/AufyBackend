const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testProfileFetch() {
  console.log('🔍 Testing Profile Fetch\n');
  
  try {
    // Step 1: Create a test user
    console.log('1️⃣ Creating test user...');
    const testUser = {
      email: 'profile_test_' + Date.now() + '@test.com',
      username: 'profiletest' + Date.now(),
      password: 'Test123!',
      name: 'Profile Test User'
    };
    
    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, testUser, {
      timeout: 15000
    });
    
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user._id;
    const username = registerResponse.data.user.username;
    
    console.log('✅ User created');
    console.log('   Username:', username);
    console.log('   User ID:', userId);
    
    // Step 2: Fetch profile by username (with auth)
    console.log('\n2️⃣ Fetching profile by username (authenticated)...');
    try {
      const profileByUsername = await axios.get(
        `${BACKEND_URL}/api/users/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
          validateStatus: () => true
        }
      );
      
      if (profileByUsername.status === 200) {
        console.log('✅ Profile fetched successfully');
        console.log('   Username:', profileByUsername.data.username);
        console.log('   Name:', profileByUsername.data.name);
        console.log('   Followers:', profileByUsername.data.followersCount);
        console.log('   Following:', profileByUsername.data.followingCount);
      } else {
        console.log('❌ Profile fetch failed');
        console.log('   Status:', profileByUsername.status);
        console.log('   Error:', profileByUsername.data);
      }
    } catch (error) {
      console.log('❌ Profile fetch error:', error.message);
    }
    
    // Step 3: Fetch profile by username (without auth)
    console.log('\n3️⃣ Fetching profile by username (unauthenticated)...');
    try {
      const profileNoAuth = await axios.get(
        `${BACKEND_URL}/api/users/${username}`,
        {
          timeout: 10000,
          validateStatus: () => true
        }
      );
      
      if (profileNoAuth.status === 200) {
        console.log('✅ Profile fetched successfully (no auth)');
        console.log('   Username:', profileNoAuth.data.username);
      } else {
        console.log('❌ Profile fetch failed (no auth)');
        console.log('   Status:', profileNoAuth.status);
        console.log('   Error:', profileNoAuth.data);
      }
    } catch (error) {
      console.log('❌ Profile fetch error (no auth):', error.message);
    }
    
    // Step 4: Fetch profile by user ID
    console.log('\n4️⃣ Fetching profile by user ID...');
    try {
      const profileById = await axios.get(
        `${BACKEND_URL}/api/users/id/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
          validateStatus: () => true
        }
      );
      
      if (profileById.status === 200) {
        console.log('✅ Profile fetched by ID successfully');
        console.log('   Username:', profileById.data.username);
      } else {
        console.log('❌ Profile fetch by ID failed');
        console.log('   Status:', profileById.status);
        console.log('   Error:', profileById.data);
      }
    } catch (error) {
      console.log('❌ Profile fetch by ID error:', error.message);
    }
    
    // Step 5: Test with non-existent user
    console.log('\n5️⃣ Testing with non-existent user...');
    try {
      const nonExistent = await axios.get(
        `${BACKEND_URL}/api/users/nonexistentuser123456`,
        {
          timeout: 10000,
          validateStatus: () => true
        }
      );
      
      if (nonExistent.status === 404) {
        console.log('✅ Correctly returns 404 for non-existent user');
      } else {
        console.log('⚠️  Unexpected status:', nonExistent.status);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('\n📊 Summary:');
    console.log('Profile endpoints are working if all tests passed.');
    console.log('If you see errors in your app, check:');
    console.log('1. The username/ID being used');
    console.log('2. Network connectivity');
    console.log('3. Authorization token validity');
    console.log('4. API URL configuration in mobile app');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testProfileFetch();
