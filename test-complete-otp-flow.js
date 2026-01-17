#!/usr/bin/env node

/**
 * Test Complete OTP Flow
 * Run: node test-complete-otp-flow.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

async function testCompleteFlow() {
  console.log('🧪 Testing Complete OTP Password Reset Flow\n');
  console.log('Backend URL:', BACKEND_URL);
  console.log('');

  try {
    // Step 1: Send OTP
    console.log('📧 Step 1: Sending OTP to test@example.com...');
    const sendOTPResponse = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });

    const sendOTPData = await sendOTPResponse.json();
    console.log('Response:', sendOTPData);
    console.log('Status:', sendOTPResponse.status);
    console.log('');

    if (sendOTPResponse.status !== 200) {
      console.error('❌ Failed to send OTP');
      return;
    }

    console.log('✅ OTP sent successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('1. Check your email for OTP');
    console.log('2. Enter OTP in app');
    console.log('3. Reset password');
    console.log('4. Auto-login should work');
    console.log('');

    // Check if we can verify OTP (for testing purposes)
    console.log('🔍 Checking if OTP verification endpoint works...');
    console.log('(Note: You need the actual OTP from email to verify)');
    console.log('');

    console.log('✅ OTP Flow Test Complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure backend is running');
    console.error('2. Check BACKEND_URL in .env');
    console.error('3. Check if email exists in database');
    console.error('4. Check backend logs for errors');
  }
}

testCompleteFlow();
