// Test network connectivity and API endpoints
const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testConnectivity() {
  console.log('🔍 Testing Network Connectivity\n');
  console.log('Backend URL:', BACKEND_URL);
  console.log('='.repeat(50), '\n');

  // Test 1: Health check
  console.log('1️⃣  Testing /health endpoint...');
  try {
    const start = Date.now();
    const response = await axios.get(`${BACKEND_URL}/health`, {
      timeout: 10000
    });
    const duration = Date.now() - start;
    console.log(`✅ Health check passed (${duration}ms)`);
    console.log(`   Response:`, response.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  console.log('');

  // Test 2: Root endpoint
  console.log('2️⃣  Testing root / endpoint...');
  try {
    const response = await axios.get(BACKEND_URL, { timeout: 10000 });
    console.log('✅ Root endpoint accessible');
    console.log(`   Response:`, response.data);
  } catch (error) {
    console.log('❌ Root endpoint failed:', error.message);
  }
  console.log('');

  // Test 3: Login endpoint (without credentials)
  console.log('3️⃣  Testing /api/auth/login endpoint...');
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'test@test.com',
      password: 'wrongpassword'
    }, { 
      timeout: 10000,
      validateStatus: () => true // Accept any status
    });
    console.log(`✅ Login endpoint accessible (Status: ${response.status})`);
    console.log(`   Response:`, response.data);
  } catch (error) {
    console.log('❌ Login endpoint failed:', error.message);
  }
  console.log('');

  // Test 4: Check CORS headers
  console.log('4️⃣  Testing CORS headers...');
  try {
    const response = await axios.options(`${BACKEND_URL}/api/auth/login`, {
      timeout: 10000,
      validateStatus: () => true
    });
    console.log('✅ CORS preflight check');
    console.log('   Access-Control-Allow-Origin:', response.headers['access-control-allow-origin'] || 'NOT SET');
    console.log('   Access-Control-Allow-Methods:', response.headers['access-control-allow-methods'] || 'NOT SET');
    console.log('   Access-Control-Allow-Headers:', response.headers['access-control-allow-headers'] || 'NOT SET');
  } catch (error) {
    console.log('❌ CORS check failed:', error.message);
  }
  console.log('');

  // Test 5: Test with malformed token (to reproduce the error)
  console.log('5️⃣  Testing with malformed token...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/users/me`, {
      headers: {
        'Authorization': 'Bearer invalid-token-123'
      },
      timeout: 10000,
      validateStatus: () => true
    });
    console.log(`✅ Endpoint responded (Status: ${response.status})`);
    console.log(`   Response:`, response.data);
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  console.log('');

  // Test 6: DNS resolution
  console.log('6️⃣  Testing DNS resolution...');
  try {
    const dns = require('dns').promises;
    const hostname = 'aufybackend.onrender.com';
    const addresses = await dns.resolve4(hostname);
    console.log('✅ DNS resolution successful');
    console.log('   IP addresses:', addresses.join(', '));
  } catch (error) {
    console.log('❌ DNS resolution failed:', error.message);
  }
  console.log('');

  console.log('='.repeat(50));
  console.log('✅ Network connectivity test complete!\n');
}

testConnectivity().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
