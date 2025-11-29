const axios = require('axios');

const possibleURLs = [
  'https://aufybackend.onrender.com',
  'https://anufy-api.onrender.com',
  'https://anufy-backend.onrender.com',
  'https://anufybackend.onrender.com'
];

async function testURL(url) {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    return { url, status: 'WORKING', data: response.data };
  } catch (error) {
    if (error.response) {
      return { url, status: 'RESPONDING', statusCode: error.response.status };
    }
    return { url, status: 'NOT FOUND', error: error.message };
  }
}

async function findCorrectURL() {
  console.log('🔍 Testing possible Render URLs...\n');
  
  const results = await Promise.all(possibleURLs.map(testURL));
  
  results.forEach(result => {
    if (result.status === 'WORKING') {
      console.log(`✅ ${result.url}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Response:`, result.data);
      console.log('   👆 THIS IS YOUR CORRECT URL!\n');
    } else if (result.status === 'RESPONDING') {
      console.log(`⚠️  ${result.url}`);
      console.log(`   Status Code: ${result.statusCode}`);
      console.log(`   (Server exists but endpoint may be different)\n`);
    } else {
      console.log(`❌ ${result.url}`);
      console.log(`   ${result.error}\n`);
    }
  });
}

findCorrectURL();
