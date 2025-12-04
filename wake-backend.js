// Wake up Render backend and test connection
const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function wakeBackend() {
  console.log('🔄 Waking up Render backend...\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  try {
    console.log('1️⃣  Pinging backend...');
    const start = Date.now();
    
    const response = await axios.get(`${BACKEND_URL}/health`, {
      timeout: 60000 // 60 second timeout for cold start
    }).catch(err => {
      // Try root endpoint if /health doesn't exist
      return axios.get(BACKEND_URL, { timeout: 60000 });
    });

    const duration = Date.now() - start;
    
    console.log(`✅ Backend is awake! (${duration}ms)`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...\n`);

    // Test the secret-crush endpoint
    console.log('2️⃣  Testing secret-crush endpoint availability...');
    const testResponse = await axios.get(`${BACKEND_URL}/api/secret-crush/my-list`, {
      headers: { Authorization: 'Bearer test' }
    }).catch(err => {
      return { status: err.response?.status, data: err.response?.data };
    });

    console.log(`   Status: ${testResponse.status}`);
    if (testResponse.status === 401) {
      console.log('✅ Endpoint exists (401 = needs valid token)\n');
    } else {
      console.log(`   Response: ${JSON.stringify(testResponse.data)}\n`);
    }

    console.log('✅ Backend is ready!\n');
    console.log('📱 Your app should now be able to connect.');
    console.log('   Try adding a favorite friend again.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Backend is not responding.');
      console.log('   This might mean:');
      console.log('   - Render service is down');
      console.log('   - Wrong URL');
      console.log('   - Network issue\n');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n⚠️  Request timed out.');
      console.log('   The backend might be starting up (cold start).');
      console.log('   Try running this script again.\n');
    }
  }
}

wakeBackend();
