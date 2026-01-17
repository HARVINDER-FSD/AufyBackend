#!/usr/bin/env node

/**
 * Direct OTP Email Test - No .env needed
 */

const { Resend } = require('resend');

// Direct API key
const API_KEY = 're_V7razQtf_4cDuGfa6u3D4FbPCKoDBhQMn';
const resend = new Resend(API_KEY);

async function sendOTPEmail() {
  console.log('📧 Sending OTP Email...\n');

  try {
    const { data, error } = await resend.emails.send({
      from: 'Anufy <onboarding@resend.dev>',
      to: ['test@example.com'],
      subject: 'Your AnuFy Password Reset OTP',
      html: `
        <h1>Reset Your Password</h1>
        <p>Hi testuser,</p>
        <p>Use this OTP to reset your password:</p>
        <div style="background-color: #f0f7ff; border: 2px solid #0095f6; border-radius: 12px; padding: 30px; text-align: center; margin: 40px 0;">
          <p style="margin: 0 0 10px; color: #8e8e8e; font-size: 14px;">Your OTP Code</p>
          <p style="margin: 0; color: #0095f6; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            123456
          </p>
        </div>
        <p>Enter this code in the AnuFy app to verify your email and reset your password.</p>
        <p><strong>⚠️ Important:</strong> This OTP will expire in 10 minutes. Do not share this code with anyone.</p>
      `,
    });

    if (error) {
      console.error('❌ Error:', error);
      return false;
    }

    console.log('✅ OTP Email Sent Successfully!');
    console.log('Email ID:', data?.id);
    console.log('To: test@example.com');
    console.log('OTP: 123456');
    return true;

  } catch (error) {
    console.error('❌ Exception:', error.message);
    return false;
  }
}

sendOTPEmail();
