/**
 * Email Configuration Test Script
 * Run: node test-email.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const configs = [
  {
    name: 'Gmail STARTTLS (Port 587)',
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    },
  },
  {
    name: 'Gmail SSL (Port 465)',
    config: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    },
  },
];

async function testEmailConfig(name, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);
  
  if (!config.auth.user || !config.auth.pass) {
    console.log('❌ EMAIL_USER or EMAIL_PASSWORD not set in .env');
    return false;
  }

  const transporter = nodemailer.createTransport(config);

  try {
    console.log('🔄 Verifying connection...');
    const startTime = Date.now();
    
    await transporter.verify();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Connection successful! (${duration}ms)`);
    
    // Try sending a test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: `"Anufy Test" <${config.auth.user}>`,
      to: config.auth.user,
      subject: 'Test Email from Anufy',
      text: 'If you receive this, your email configuration is working!',
      html: '<p>If you receive this, your email configuration is working!</p>',
    });
    
    console.log(`✅ Test email sent! Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
    return false;
  }
}

async function main() {
  console.log('📧 Email Configuration Test');
  console.log(`Email User: ${process.env.EMAIL_USER || 'NOT SET'}`);
  console.log(`Email Password: ${process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET'}`);

  let successCount = 0;
  
  for (const { name, config } of configs) {
    const success = await testEmailConfig(name, config);
    if (success) successCount++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${successCount}/${configs.length} configurations working`);
  console.log(`${'='.repeat(60)}`);

  if (successCount === 0) {
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Verify your Gmail App Password is correct (16 characters, no spaces)');
    console.log('2. Enable 2FA: https://myaccount.google.com/security');
    console.log('3. Generate App Password: https://myaccount.google.com/apppasswords');
    console.log('4. Check if Gmail is blocking the connection');
    console.log('5. Try using SendGrid or Brevo instead (see .env for setup)');
    console.log('\n📚 Alternative: Use SendGrid (Free 100 emails/day)');
    console.log('   Sign up: https://signup.sendgrid.com/');
    console.log('   Then update .env with SendGrid credentials');
  }
}

main().catch(console.error);
