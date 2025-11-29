const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testEmailSpeed() {
  console.log('🚀 Testing Email Speed Optimization\n');
  console.log('Backend URL:', BACKEND_URL);
  console.log('Testing endpoint: /api/auth/forgot-password\n');
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, {
      email: 'test@example.com'
    }, {
      timeout: 10000
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log('✅ Response received!');
    console.log(`⚡ Response time: ${responseTime}ms`);
    console.log(`📧 Message: ${response.data.message}\n`);
    
    if (responseTime < 500) {
      console.log('🎉 EXCELLENT! Response is instant (< 500ms)');
      console.log('✅ Async email optimization is working perfectly!');
    } else if (responseTime < 1000) {
      console.log('✅ GREAT! Response is very fast (< 1 second)');
      console.log('✅ Optimization is working!');
    } else if (responseTime < 2000) {
      console.log('✅ GOOD! Response is fast (< 2 seconds)');
      console.log('⚠️  Could be faster - check if deployment completed');
    } else {
      console.log('⚠️  Response is slow (> 2 seconds)');
      console.log('Possible issues:');
      console.log('1. Render service is cold starting');
      console.log('2. Deployment not completed yet');
      console.log('3. Database query is slow');
      console.log('4. Code changes not deployed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testEmailSpeed();
