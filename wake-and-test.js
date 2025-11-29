const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function wakeAndTest() {
  console.log('🔍 Checking backend status...\n');
  
  // Step 1: Check health endpoint
  console.log('1️⃣ Testing /health endpoint...');
  try {
    const healthResponse = await axios.get(`${BACKEND_URL}/health`, { timeout: 30000 });
    console.log('✅ Health check passed:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    console.log('⚠️  Backend might be sleeping. Waiting 30 seconds...\n');
    return;
  }
  
  // Step 2: Test login
  console.log('\n2️⃣ Testing /api/auth/login endpoint...');
  try {
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'test@test.com',
      password: 'test123'
    }, {
      timeout: 15000,
      validateStatus: () => true
    });
    
    console.log(`Status: ${loginResponse.status}`);
    console.log(`Message: ${loginResponse.data.message || 'No message'}`);
    
    if (loginResponse.status === 401) {
      console.log('✅ Login endpoint is working (credentials invalid, but endpoint responds)');
    } else if (loginResponse.status === 200) {
      console.log('✅ Login successful!');
    } else {
      console.log('⚠️  Unexpected status:', loginResponse.status);
    }
    
  } catch (error) {
    console.log('❌ Login test failed:', error.message);
  }
  
  // Step 3: Check MongoDB connection
  console.log('\n3️⃣ Checking if MongoDB is accessible...');
  console.log('Check Render logs for MongoDB connection errors');
  console.log('Common issues:');
  console.log('  - MongoDB IP whitelist (add 0.0.0.0/0 to allow all)');
  console.log('  - MONGODB_URI environment variable not set');
  console.log('  - MongoDB Atlas cluster paused');
}

wakeAndTest();
