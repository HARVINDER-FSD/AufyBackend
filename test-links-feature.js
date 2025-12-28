// Test script to verify links feature is working
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testLinksFeature() {
  console.log('🧪 Testing Links Feature...\n');

  try {
    // 1. Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // 2. Get current user data
    console.log('2️⃣ Getting current user data...');
    const userResponse = await axios.get(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Current user data:');
    console.log('- Username:', userResponse.data.username);
    console.log('- Bio:', userResponse.data.bio || '(empty)');
    console.log('- Links:', userResponse.data.links || []);
    console.log('');

    // 3. Update profile with links
    console.log('3️⃣ Updating profile with links...');
    const testLinks = [
      'https://github.com/testuser',
      'https://twitter.com/testuser',
      'https://linkedin.com/in/testuser'
    ];

    const updateResponse = await axios.put(
      `${API_URL}/api/users/profile`,
      { links: testLinks },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('✅ Profile updated successfully\n');

    // 4. Verify links were saved
    console.log('4️⃣ Verifying links were saved...');
    const verifyResponse = await axios.get(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Updated user data:');
    console.log('- Links:', verifyResponse.data.links);
    console.log('');

    if (verifyResponse.data.links && verifyResponse.data.links.length === testLinks.length) {
      console.log('✅ SUCCESS! Links are being saved and retrieved correctly');
      console.log('📊 Test Results:');
      console.log('   - Links saved:', testLinks.length);
      console.log('   - Links retrieved:', verifyResponse.data.links.length);
      console.log('   - Match:', JSON.stringify(testLinks) === JSON.stringify(verifyResponse.data.links));
    } else {
      console.log('❌ FAILED! Links not saved correctly');
      console.log('   - Expected:', testLinks);
      console.log('   - Got:', verifyResponse.data.links);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testLinksFeature();
