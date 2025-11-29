const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testLogin() {
  console.log('🔐 Testing Login Endpoint\n');
  
  // Test with a known user
  const testCredentials = {
    email: 'harvinderfsd@gmail.com',
    password: 'test123' // Use your actual password
  };
  
  try {
    console.log('Attempting login...');
    console.log('Email:', testCredentials.email);
    
    const startTime = Date.now();
    
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, testCredentials, {
      timeout: 15000,
      validateStatus: () => true // Don't throw on any status
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`\n⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ LOGIN SUCCESSFUL!');
      console.log('User:', response.data.user?.username);
      console.log('Token received:', response.data.token ? 'Yes' : 'No');
    } else if (response.status === 401) {
      console.log('❌ LOGIN FAILED: Invalid credentials');
      console.log('Message:', response.data.message);
    } else if (response.status === 429) {
      console.log('⚠️  TOO MANY ATTEMPTS: Rate limited');
      console.log('Message:', response.data.message);
    } else {
      console.log('❌ ERROR:', response.status);
      console.log('Response:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.log('⚠️  Request timeout - backend might be sleeping');
    }
  }
}

testLogin();
