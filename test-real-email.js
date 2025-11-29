const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testRealEmail() {
  console.log('📧 Testing Real Email Delivery\n');
  
  const testEmail = 'harvinderfsd@gmail.com'; // Your real email
  
  try {
    console.log(`Sending password reset to: ${testEmail}`);
    console.log('Please check your inbox...\n');
    
    const startTime = Date.now();
    
    const response = await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, {
      email: testEmail
    }, {
      timeout: 15000
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log('✅ API Response received!');
    console.log(`⚡ Response time: ${responseTime}ms`);
    console.log(`📧 Message: ${response.data.message}\n`);
    
    console.log('🔍 Now check your email inbox:');
    console.log('   - Check spam/junk folder if not in inbox');
    console.log('   - Email should arrive within 10-30 seconds');
    console.log('   - Look for email from "Anufy <onboarding@resend.dev>"');
    console.log('   - Subject: "Reset Your Anufy Password"');
    console.log('\n✅ If email arrives, Resend is working perfectly!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testRealEmail();
