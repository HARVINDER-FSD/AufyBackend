const axios = require('axios');

// Test mobile app authentication flow
const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testMobileAppAuth() {
  console.log('🔍 Testing Mobile App Authentication Flow...\n');

  try {
    // Step 1: Login
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    });

    if (loginResponse.status === 200) {
      const { token, user } = loginResponse.data;
      console.log('✅ Login successful:', {
        username: user.username,
        userId: user.id,
        tokenLength: token.length
      });

      // Step 2: Test secret crush endpoint with proper headers
      console.log('\n2. Testing secret crush endpoint...');
      try {
        const crushResponse = await axios.get(`${BACKEND_URL}/api/secret-crush/my-list`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Secret crush endpoint working:', {
          status: crushResponse.status,
          crushCount: crushResponse.data.count,
          mutualCount: crushResponse.data.mutualCount,
          maxCrushes: crushResponse.data.maxCrushes
        });
      } catch (crushError) {
        console.error('❌ Secret crush endpoint failed:', {
          status: crushError.response?.status,
          message: crushError.response?.data?.message || crushError.message
        });
      }

      // Step 3: Test mutual followers endpoint
      console.log('\n3. Testing mutual followers endpoint...');
      try {
        const mutualResponse = await axios.get(`${BACKEND_URL}/api/users/${user.id}/mutual-followers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Mutual followers endpoint working:', {
          status: mutualResponse.status,
          followersCount: mutualResponse.data.data?.length || 0
        });

        // Show some sample followers for testing
        if (mutualResponse.data.data && mutualResponse.data.data.length > 0) {
          console.log('📋 Sample mutual followers:');
          mutualResponse.data.data.slice(0, 3).forEach((follower, index) => {
            console.log(`  ${index + 1}. ${follower.username} (${follower.full_name}) - ID: ${follower.id || follower._id}`);
          });
        }
      } catch (mutualError) {
        console.error('❌ Mutual followers endpoint failed:', {
          status: mutualError.response?.status,
          message: mutualError.response?.data?.message || mutualError.message
        });
      }

      // Step 4: Test adding a secret crush (if we have mutual followers)
      console.log('\n4. Testing add secret crush...');
      try {
        // First get mutual followers to find someone to add
        const mutualResponse = await axios.get(`${BACKEND_URL}/api/users/${user.id}/mutual-followers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (mutualResponse.data.data && mutualResponse.data.data.length > 0) {
          const testUser = mutualResponse.data.data[0];
          const testUserId = testUser.id || testUser._id;
          
          console.log(`Trying to add ${testUser.username} (${testUserId}) as secret crush...`);
          
          const addResponse = await axios.post(`${BACKEND_URL}/api/secret-crush/add/${testUserId}`, {}, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Add secret crush working:', {
            status: addResponse.status,
            message: addResponse.data.message,
            isMutual: addResponse.data.isMutual
          });
        } else {
          console.log('⚠️ No mutual followers found to test with');
        }
      } catch (addError) {
        console.error('❌ Add secret crush failed:', {
          status: addError.response?.status,
          message: addError.response?.data?.message || addError.message
        });
      }

    } else {
      console.error('❌ Login failed:', loginResponse.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

testMobileAppAuth();