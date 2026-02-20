require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testRegister() {
  console.log('🧪 Testing Registration API...\n');
  
  const suffix = Date.now().toString().slice(-6);
  const testData = {
    username: `testuser_${suffix}`,
    full_name: 'Test User',
    email: `testuser_${suffix}@example.com`,
    password: 'TestPassword123!',
    dob: '1995-05-15'
  };

  try {
    console.log('📤 Sending registration request to:', BACKEND_URL);
    console.log('📋 Data:', testData);
    console.log('');

    const response = await axios.post(`${BACKEND_URL}/api/auth/register`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Registration successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Registration failed!');
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📋 Error:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('❌ No response from server');
      console.log('📋 Error:', error.message);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testRegister();
