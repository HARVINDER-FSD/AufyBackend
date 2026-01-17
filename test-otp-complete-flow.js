#!/usr/bin/env node

/**
 * Complete OTP Flow Test
 * Tests: Email sending → OTP verification → Password reset
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = 'test-otp-' + Date.now() + '@example.com';
const TEST_PASSWORD = 'TestPass123!@#';

let generatedOTP = null;

async function makeRequest(endpoint, method = 'POST', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    throw error;
  }
}

async function testStep1_SendOTP() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 1: Send OTP Email');
  console.log('='.repeat(60));
  console.log(`📧 Sending OTP to: ${TEST_EMAIL}`);

  try {
    const { status, data } = await makeRequest('/api/auth/forgot-password', 'POST', {
      email: TEST_EMAIL,
    });

    if (status === 200) {
      console.log('✅ OTP request successful');
      console.log(`📝 Response: ${data.message}`);
      console.log('\n⏳ Waiting 3 seconds for email to be sent...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return true;
    } else {
      console.error(`❌ Failed with status ${status}`);
      console.error(`📝 Response: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testStep2_VerifyOTP() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Verify OTP');
  console.log('='.repeat(60));

  // For testing, we'll try a few common OTPs
  // In production, you'd get this from the email
  const testOTPs = ['000000', '123456', '999999'];

  console.log('⚠️  Note: In production, get OTP from email');
  console.log('📝 Trying test OTPs...\n');

  for (const otp of testOTPs) {
    console.log(`🔍 Trying OTP: ${otp}`);
    try {
      const { status, data } = await makeRequest('/api/auth/verify-otp', 'POST', {
        email: TEST_EMAIL,
        otp: otp,
      });

      if (status === 200 && data.verified) {
        console.log(`✅ OTP verified successfully!`);
        generatedOTP = otp;
        return true;
      } else {
        console.log(`❌ OTP ${otp} failed: ${data.message}`);
      }
    } catch (error) {
      console.log(`❌ Error with OTP ${otp}: ${error.message}`);
    }
  }

  console.log('\n⚠️  Could not verify OTP with test values');
  console.log('📝 Check backend logs for actual OTP');
  console.log('📝 Or check email inbox for OTP');
  return false;
}

async function testStep3_ResetPassword() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Reset Password');
  console.log('='.repeat(60));

  if (!generatedOTP) {
    console.log('⚠️  Skipping - OTP not verified in previous step');
    console.log('📝 To test this step, manually get OTP from email and update script');
    return false;
  }

  console.log(`🔐 Resetting password with OTP: ${generatedOTP}`);
  console.log(`🔑 New password: ${TEST_PASSWORD}`);

  try {
    const { status, data } = await makeRequest('/api/auth/reset-password-otp', 'POST', {
      email: TEST_EMAIL,
      otp: generatedOTP,
      newPassword: TEST_PASSWORD,
    });

    if (status === 200) {
      console.log('✅ Password reset successful!');
      console.log(`🎫 Token received: ${data.token ? 'Yes' : 'No'}`);
      if (data.user) {
        console.log(`👤 User: ${data.user.username}`);
        console.log(`📧 Email: ${data.user.email}`);
      }
      return true;
    } else {
      console.error(`❌ Failed with status ${status}`);
      console.error(`📝 Response: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testStep4_LoginWithNewPassword() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 4: Login with New Password');
  console.log('='.repeat(60));

  console.log(`🔐 Attempting login with new password`);
  console.log(`📧 Email: ${TEST_EMAIL}`);
  console.log(`🔑 Password: ${TEST_PASSWORD}`);

  try {
    const { status, data } = await makeRequest('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (status === 200) {
      console.log('✅ Login successful!');
      console.log(`🎫 Token received: ${data.token ? 'Yes' : 'No'}`);
      if (data.user) {
        console.log(`👤 User: ${data.user.username}`);
      }
      return true;
    } else {
      console.error(`❌ Failed with status ${status}`);
      console.error(`📝 Response: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('OTP EMAIL VERIFICATION - COMPLETE FLOW TEST');
  console.log('█'.repeat(60));
  console.log(`🌐 API URL: ${API_URL}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log(`⏰ Started: ${new Date().toLocaleString()}`);

  const results = {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
  };

  // Step 1: Send OTP
  results.step1 = await testStep1_SendOTP();

  // Step 2: Verify OTP
  if (results.step1) {
    results.step2 = await testStep2_VerifyOTP();
  }

  // Step 3: Reset Password
  if (results.step2) {
    results.step3 = await testStep3_ResetPassword();
  }

  // Step 4: Login with new password
  if (results.step3) {
    results.step4 = await testStep4_LoginWithNewPassword();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Step 1 - Send OTP:        ${results.step1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Step 2 - Verify OTP:      ${results.step2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Step 3 - Reset Password:  ${results.step3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Step 4 - Login:           ${results.step4 ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'));
  console.log('='.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
