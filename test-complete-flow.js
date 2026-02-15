
const axios = require('axios');

const BASE_URL = 'https://aufybackend.onrender.com';
const TEST_USER = {
  username: `test_user_${Math.floor(Math.random() * 10000)}`,
  email: `test_${Math.floor(Math.random() * 10000)}@example.com`,
  password: 'TestPassword123!',
  full_name: 'Test User FullName',
  dob: '2000-01-01'
};

async function runFullTest() {
  console.log('🚀 Running Full Backend Verification...');
  console.log('----------------------------------------');

  // 1. REGISTER
  console.log('1️⃣  Testing Register...');
  try {
    const regRes = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER);
    console.log('   ✅ Register SUCCESS!');
    console.log('      User ID:', regRes.data.user.id);
    console.log('      Username:', regRes.data.user.username);
  } catch (error) {
    console.error('   ❌ Register FAILED:', error.response?.data || error.message);
    return; // Stop if register fails
  }

  // 2. LOGIN
  console.log('\n2️⃣  Testing Login...');
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    console.log('   ✅ Login SUCCESS!');
    console.log('      Token received:', !!loginRes.data.token);
  } catch (error) {
    console.error('   ❌ Login FAILED:', error.response?.data || error.message);
  }

  // 3. FORGOT PASSWORD (OTP)
  console.log('\n3️⃣  Testing Forgot Password (OTP)...');
  try {
    const forgotRes = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
      email: TEST_USER.email
    });
    console.log('   ✅ Forgot Password Request SUCCESS!');
    console.log('      Message:', forgotRes.data.message);
    
    // Check if dev_otp is returned (only in dev mode, but good to check)
    if (forgotRes.data.dev_otp) {
      console.log('      🔑 DEV OTP Received:', forgotRes.data.dev_otp);
    } else {
      console.log('      📧 Email sent (Check Inbox/Spam)');
    }
  } catch (error) {
    console.error('   ❌ Forgot Password FAILED:', error.response?.data || error.message);
  }

  console.log('\n----------------------------------------');
  console.log('🏁 Test Complete');
}

runFullTest();
