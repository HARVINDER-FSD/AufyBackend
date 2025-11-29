const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testRegisterAndLogin() {
  console.log('🔐 Testing Registration and Login\n');
  
  // Create a test account
  const testUser = {
    email: 'test' + Date.now() + '@example.com',
    username: 'testuser' + Date.now(),
    password: 'Test123!',
    name: 'Test User'
  };
  
  console.log('1️⃣ Creating new account...');
  console.log('Email:', testUser.email);
  console.log('Username:', testUser.username);
  console.log('Password:', testUser.password);
  
  try {
    // Register
    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, testUser, {
      timeout: 15000,
      validateStatus: () => true
    });
    
    if (registerResponse.status === 200) {
      console.log('✅ Registration successful!');
      console.log('User ID:', registerResponse.data.user._id);
      console.log('Token received:', registerResponse.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Registration failed:', registerResponse.status);
      console.log('Message:', registerResponse.data.message);
      return;
    }
    
    // Wait a moment
    console.log('\n2️⃣ Testing login with same credentials...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Login
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    }, {
      timeout: 15000,
      validateStatus: () => true
    });
    
    if (loginResponse.status === 200) {
      console.log('✅ Login successful!');
      console.log('User:', loginResponse.data.user.username);
      console.log('Token received:', loginResponse.data.token ? 'Yes' : 'No');
      console.log('\n🎉 Both registration and login are working perfectly!');
    } else {
      console.log('❌ Login failed:', loginResponse.status);
      console.log('Message:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testExistingLogin() {
  console.log('\n\n📝 To test with your existing account:');
  console.log('1. Make sure you know your correct email and password');
  console.log('2. Or use the mobile app to register a new account');
  console.log('3. Then try logging in through the app');
}

testRegisterAndLogin().then(() => testExistingLogin());
