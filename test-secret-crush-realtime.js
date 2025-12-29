// Test script for real-time secret crush updates
const axios = require('axios');

const API_BASE = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testSecretCrushRealtime() {
  console.log('🧪 Testing Secret Crush Real-time Updates...');
  
  try {
    // Test credentials (replace with actual test user)
    const testUser = {
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    };

    console.log('🔐 Logging in as test user...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, testUser);
    
    console.log('Login response:', loginResponse.data);
    
    if (!loginResponse.data.token) {
      throw new Error(`Login failed: ${loginResponse.data.message || 'No token received'}`);
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Test the new last-update endpoint
    console.log('📡 Testing /api/secret-crush/last-update endpoint...');
    const lastUpdateResponse = await axios.get(`${API_BASE}/api/secret-crush/last-update`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Last update endpoint response:', lastUpdateResponse.data);

    // Test the existing my-list endpoint
    console.log('📡 Testing /api/secret-crush/my-list endpoint...');
    const myListResponse = await axios.get(`${API_BASE}/api/secret-crush/my-list`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ My list endpoint response:', {
      success: myListResponse.data.success,
      crushCount: myListResponse.data.crushes?.length || 0,
      mutualCount: myListResponse.data.mutualCount || 0
    });

    // Test real-time polling simulation
    console.log('⏰ Simulating real-time polling...');
    
    let lastUpdateTime = lastUpdateResponse.data.lastUpdate;
    console.log('📅 Initial last update time:', lastUpdateTime);
    
    // Wait 2 seconds and check again
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const secondCheckResponse = await axios.get(`${API_BASE}/api/secret-crush/last-update`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const newLastUpdateTime = secondCheckResponse.data.lastUpdate;
    console.log('📅 Second check last update time:', newLastUpdateTime);
    
    if (lastUpdateTime === newLastUpdateTime) {
      console.log('✅ No changes detected (as expected)');
    } else {
      console.log('🔄 Changes detected between checks');
    }

    console.log('🎉 All real-time secret crush tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('💡 The endpoint might not be deployed yet. Deploy the backend first.');
    }
  }
}

testSecretCrushRealtime();