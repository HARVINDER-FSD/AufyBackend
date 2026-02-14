
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { Resend } = require('resend');

const MONGODB_URI = process.env.MONGODB_URI;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TARGET_EMAIL = 'harvindersinghharvinder9999@gmail.com'; // User's email

async function runDiagnostics() {
  console.log('🔍 Starting Auth & Email Diagnostics...');
  console.log('=======================================');

  // 1. Check Environment Variables
  console.log('\n1. Checking Environment Variables:');
  console.log(`- MONGODB_URI: ${MONGODB_URI ? 'Exists' : 'MISSING ❌'}`);
  console.log(`- RESEND_API_KEY: ${RESEND_API_KEY ? 'Exists' : 'MISSING ❌'}`);

  if (!MONGODB_URI || !RESEND_API_KEY) {
    console.error('❌ Critical: Missing environment variables.');
    process.exit(1);
  }

  // 2. Test Database Connection
  console.log('\n2. Testing Database Connection:');
  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true, // Fix for cloud envs
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    console.log('✅ MongoDB Connected Successfully!');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Check if user exists
    const user = await usersCollection.findOne({ email: TARGET_EMAIL });
    if (user) {
      console.log(`✅ User found: ${user.email} (Username: ${user.username})`);
      console.log(`   - Has Password: ${!!user.password}`);
      console.log(`   - Verified: ${user.verified}`);
    } else {
      console.warn(`⚠️ User not found: ${TARGET_EMAIL}`);
    }

  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
  } finally {
    if (client) await client.close();
  }

  // 3. Test Email Sending
  console.log('\n3. Testing Email Sending (Resend):');
  const resend = new Resend(RESEND_API_KEY);

  try {
    console.log(`📧 Attempting to send email to: ${TARGET_EMAIL}`);
    
    const { data, error } = await resend.emails.send({
      from: 'Anufy <onboarding@resend.dev>', // MUST be this for free tier unless domain is verified
      to: [TARGET_EMAIL], // Free tier only allows sending to verified email (usually the account owner's email)
      subject: 'AnuFy Diagnostic Test Email',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>AnuFy Email Test</h1>
          <p>This is a diagnostic email to verify that your email configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p>If you received this, the backend email service is operational! ✅</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email Send Failed:', error);
      if (error.message && error.message.includes('resend.dev')) {
        console.log('\n💡 Hint: For Resend Free Tier, you can only send emails to the email address you signed up with.');
        console.log('   Ensure TARGET_EMAIL is verified in your Resend Dashboard.');
      }
    } else {
      console.log('✅ Email Sent Successfully!');
      console.log('   ID:', data.id);
    }

  } catch (error) {
    console.error('❌ Email Exception:', error.message);
  }

  console.log('\n=======================================');
  console.log('Diagnostics Complete.');
}

runDiagnostics();
