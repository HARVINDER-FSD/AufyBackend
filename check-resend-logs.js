const axios = require('axios');

async function checkResendLogs() {
  console.log('🔍 Checking if Resend is being called...\n');
  
  try {
    // Send request
    console.log('Sending password reset request...');
    const response = await axios.post('https://aufybackend.onrender.com/api/auth/forgot-password', {
      email: 'harvinderfsd@gmail.com'
    }, {
      timeout: 15000
    });
    
    console.log('✅ API responded:', response.data.message);
    console.log('\n📋 What to check on Render:');
    console.log('1. Go to: https://dashboard.render.com');
    console.log('2. Click on your "aufybackend" service');
    console.log('3. Click "Logs" tab');
    console.log('4. Look for these log messages:');
    console.log('   - "[FORGOT PASSWORD] Reset token for..."');
    console.log('   - "✅ Password reset email sent via Resend"');
    console.log('   - "❌ Resend error" (if there\'s an error)');
    console.log('\n🔧 If you see "RESEND_API_KEY not configured":');
    console.log('   - Go to Environment tab on Render');
    console.log('   - Add: RESEND_API_KEY = re_V7razQtf_4cDuGfa6u3D4FbPCKoDBhQMn');
    console.log('   - Click "Save Changes"');
    console.log('   - Wait for redeploy');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkResendLogs();
