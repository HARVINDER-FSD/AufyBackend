#!/usr/bin/env node

/**
 * Test Email Sending
 * Run: node test-email-send.js
 */

require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmailSend() {
  console.log('🧪 Testing Email Send...\n');
  console.log('Configuration:');
  console.log('- API Key:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('- Backend URL:', process.env.BACKEND_URL || 'http://localhost:5001');
  console.log('');

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not configured in .env');
    process.exit(1);
  }

  try {
    console.log('📧 Sending test email...\n');

    const testToken = 'test_token_' + Math.random().toString(36).substring(7);
    const resetUrl = `${process.env.BACKEND_URL || 'http://localhost:5001'}/reset-password?token=${testToken}`;

    const { data, error } = await resend.emails.send({
      from: 'noreply@anufy.com',
      to: ['test@example.com'],
      subject: 'Test: Reset Your Anufy Password',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify the email service is working.</p>
        <p>Reset URL: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>Token: ${testToken}</p>
      `,
    });

    if (error) {
      console.error('❌ Email Send Failed:');
      console.error('Error:', error);
      console.error('\nTroubleshooting:');
      console.error('1. Check if RESEND_API_KEY is correct');
      console.error('2. Verify domain is verified in Resend dashboard');
      console.error('3. Check if email is in free tier limits');
      console.error('4. Try using onboarding@resend.dev for testing');
      process.exit(1);
    }

    console.log('✅ Email Sent Successfully!');
    console.log('\nResponse:');
    console.log('- Email ID:', data?.id);
    console.log('- From: noreply@anufy.com');
    console.log('- To: test@example.com');
    console.log('- Subject: Test: Reset Your Anufy Password');
    console.log('\n📝 Note: Check your email inbox (or spam folder)');
    console.log('🔗 Reset URL:', resetUrl);
    console.log('🔑 Token:', testToken);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull Error:');
    console.error(error);
    process.exit(1);
  }
}

testEmailSend();
