const axios = require('axios');

async function testBackend() {
  const BACKEND_URL = 'https://aufybackend.onrender.com';
  
  console.log('🔍 Testing backend endpoints...\n');
  
  // Test different endpoints to see what's working
  const endpoints = [
    '/',
    '/api',
    '/api/auth/login',
    '/api/secret-crush/my-list'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${BACKEND_URL}${endpoint}`);
      
      if (endpoint === '/api/auth/login') {
        // POST request for login
        const response = await axios.post(`${BACKEND_URL}${endpoint}`, {
          username: 'test',
          password: 'test'
        }, { timeout: 10000 });
        
        console.log(`✅ ${endpoint}: ${response.status} - ${response.statusText}`);
      } else if (endpoint === '/api/secret-crush/my-list') {
        // GET request with fake token
        const response = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { 'Authorization': 'Bearer fake-token' },
          timeout: 10000
        });
        
        console.log(`✅ ${endpoint}: ${response.status} - ${response.statusText}`);
      } else {
        // Regular GET request
        const response = await axios.get(`${BACKEND_URL}${endpoint}`, { 
          timeout: 10000 
        });
        
        console.log(`✅ ${endpoint}: ${response.status} - ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.response?.status || 'TIMEOUT'} - ${error.response?.statusText || error.message}`);
      
      if (error.response?.data) {
        console.log(`   Data:`, error.response.data);
      }
    }
    
    console.log(''); // Empty line for readability
  }
}

testBackend();