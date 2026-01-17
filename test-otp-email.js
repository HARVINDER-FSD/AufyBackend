#!/usr/bin/env node

/**
 * Test OTP Email Sending
 * Run: node test-otp-email.js
 */

require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testOTPEmailSend() {
  console.log('🧪 Testing OTP Email Send...\n');
  console.log('Configuration:');
  console.log('- API Key:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('');

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not configured in .env');
    process.exit(1);
  }

  try {
    console.log('📧 Sending test OTP email...\n');

    const testOTP = '123456';
    const testEmail = 'test@example.com';
    const testUsername = 'testuser';

    const { data, error } = await resend.emails.send({
      from: 'Anufy <onboarding@resend.dev>',
      to: [testEmail],
      subject: 'Test: Your AnuFy Password Reset OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Anufy</h1>
                      <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Connect. Share. Inspire.</p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #262626; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        Hi ${testUsername},
                      </p>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        We received a request to reset your password. Use the OTP below to verify your identity and reset your password in the AnuFy app:
                      </p>
                      
                      <div style="background-color: #f0f7ff; border: 2px solid #0095f6; border-radius: 12px; padding: 30px; text-align: center; margin: 40px 0;">
                        <p style="margin: 0 0 10px; color: #8e8e8e; font-size: 14px;">Your OTP Code</p>
                        <p style="margin: 0; color: #0095f6; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${testOTP}
                        </p>
                      </div>
                      
                      <p style="margin: 20px 0; color: #262626; font-size: 16px; line-height: 24px; text-align: center;">
                        Enter this code in the AnuFy app to verify your email and reset your password.
                      </p>
                      
                      <div style="margin: 30px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 20px;">
                          <strong>⚠️ Important:</strong> This OTP will expire in 10 minutes. Do not share this code with anyone.
                        </p>
                      </div>
                      
                      <p style="margin: 0; color: #262626; font-size: 16px; line-height: 24px;">
                        Thanks,<br>
                        The Anufy Team
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #dbdbdb; text-align: center;">
                      <p style="margin: 0; color: #8e8e8e; font-size: 12px; line-height: 18px;">
                        © 2026 Anufy. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ OTP Email Send Failed:');
      console.error('Error:', error);
      console.error('\nTroubleshooting:');
      console.error('1. Check if RESEND_API_KEY is correct');
      console.error('2. Verify domain is verified in Resend dashboard');
      console.error('3. Check if email is in free tier limits');
      console.error('4. Try using onboarding@resend.dev for testing');
      process.exit(1);
    }

    console.log('✅ OTP Email Sent Successfully!');
    console.log('\nResponse:');
    console.log('- Email ID:', data?.id);
    console.log('- From: Anufy <onboarding@resend.dev>');
    console.log('- To: test@example.com');
    console.log('- Subject: Test: Your AnuFy Password Reset OTP');
    console.log('- OTP: 123456');
    console.log('\n📝 Note: Check your email inbox (or spam folder)');
    console.log('🔑 OTP: 123456');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull Error:');
    console.error(error);
    process.exit(1);
  }
}

testOTPEmailSend();
