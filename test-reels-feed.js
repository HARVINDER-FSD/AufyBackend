const axios = require('axios');

async function testReelsFeed() {
  try {
    console.log('Testing reels feed endpoint...\n');
    
    // Test 1: Without auth
    console.log('Test 1: Without authentication');
    try {
      const res = await axios.get('http://localhost:5001/api/reels/feed');
      console.log('✅ Success:', res.status);
      console.log('Data:', JSON.stringify(res.data, null, 2).substring(0, 200));
    } catch (err) {
      console.log('❌ Error:', err.response?.status, err.response?.data?.error);
    }
    
    // Test 2: With invalid token
    console.log('\nTest 2: With invalid token');
    try {
      const res = await axios.get('http://localhost:5001/api/reels/feed', {
        headers: { Authorization: 'Bearer invalid' }
      });
      console.log('✅ Success:', res.status);
    } catch (err) {
      console.log('❌ Error:', err.response?.status, err.response?.data?.error);
    }
    
    // Test 3: With page and limit
    console.log('\nTest 3: With pagination');
    try {
      const res = await axios.get('http://localhost:5001/api/reels/feed?page=1&limit=10');
      console.log('✅ Success:', res.status);
      console.log('Data:', JSON.stringify(res.data, null, 2).substring(0, 200));
    } catch (err) {
      console.log('❌ Error:', err.response?.status, err.response?.data?.error);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testReelsFeed();
