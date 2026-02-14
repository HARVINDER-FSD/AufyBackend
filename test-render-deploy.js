
const axios = require('axios');

const BASE_URL = 'https://aufybackend.onrender.com';
const TEST_USER = {
  email: `render_test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  username: `render_test_${Date.now()}`,
  full_name: 'Render Test User',
  dob: '2000-01-01'
};

async function testRenderBackend() {
  console.log('🌍 Testing Render Deployment:', BASE_URL);
  console.log('----------------------------------------');

  // 1. Health Check
  try {
    console.log('1️⃣  Checking Health...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅ Health Check Passed:', health.data);
  } catch (error) {
    console.error('   ❌ Health Check Failed:', error.message);
    if (error.response) console.log('      Status:', error.response.status);
    return; // Stop if server is down
  }

  // 2. Register
  try {
    console.log('\n2️⃣  Testing Registration...');
    console.log('   User:', TEST_USER.email);
    
    const register = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER);
    console.log('   ✅ Registration Successful!');
    console.log('   User ID:', register.data.user.id);
  } catch (error) {
    console.error('   ❌ Registration Failed:', error.message);
    if (error.response) {
      console.log('      Data:', error.response.data);
    }
    return;
  }

  // 3. Login
  try {
    console.log('\n3️⃣  Testing Login...');
    const login = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    console.log('   ✅ Login Successful!');
    console.log('   Token received:', !!login.data.token);
  } catch (error) {
    console.error('   ❌ Login Failed:', error.message);
    if (error.response) {
      console.log('      Data:', error.response.data);
    }
  }

  console.log('\n----------------------------------------');
  console.log('🏁 Render Test Complete');
}

testRenderBackend();
