const axios = require('axios');

// Test secret crush API endpoints with correct authentication
const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testSecretCrushAPI() {
  console.log('🔍 Testing Secret Crush API endpoints...\n');

  try {
    // First, let's test a simple login to get a valid token
    console.log('1. Testing login to get valid token...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    });

    if (loginResponse.status === 200) {
      const token = loginResponse.data.token;
      const userId = loginResponse.data.user.id;
      console.log('✅ Login successful, got token for user:', loginResponse.data.user.username);

      // Test the secret crush endpoints
      console.log('\n2. Testing /api/secret-crush/my-list endpoint...');
      
      try {
        const crushListResponse = await axios.get(`${BACKEND_URL}/api/secret-crush/my-list`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Secret crush list endpoint working:', {
          status: crushListResponse.status,
          data: crushListResponse.data
        });
      } catch (crushError) {
        console.error('❌ Secret crush list endpoint error:', {
          status: crushError.response?.status,
          statusText: crushError.response?.statusText,
          data: crushError.response?.data,
          message: crushError.message
        });
      }

      // Test mutual followers endpoint
      console.log('\n3. Testing mutual followers endpoint...');
      try {
        const mutualResponse = await axios.get(`${BACKEND_URL}/api/users/${userId}/mutual-followers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Mutual followers endpoint working:', {
          status: mutualResponse.status,
          count: mutualResponse.data?.data?.length || 0,
          data: mutualResponse.data
        });
      } catch (mutualError) {
        console.error('❌ Mutual followers endpoint error:', {
          status: mutualError.response?.status,
          statusText: mutualError.response?.statusText,
          data: mutualError.response?.data,
          message: mutualError.message
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

testSecretCrushAPI();