// Debug why FollowContext shows 0 following
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';
const EMAIL = 'hs8339952@gmail.com';
const PASSWORD = 'abc123';

async function debugFollowContext() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, '(ID:', userId, ')');

    // Test the exact endpoint that FollowContext uses
    console.log(`\n📋 Testing: /api/users/${userId}/following`);
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Response status:', followingResponse.status);
    console.log('Response headers:', Object.fromEntries(followingResponse.headers.entries()));

    if (!followingResponse.ok) {
      const errorText = await followingResponse.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const rawData = await followingResponse.text();
    console.log('\n📦 Raw response:', rawData.substring(0, 500));

    let data;
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e.message);
      return;
    }

    console.log('\n📊 Parsed data structure:');
    console.log('- Is Array:', Array.isArray(data));
    console.log('- Has .data property:', !!data.data);
    console.log('- Type:', typeof data);
    console.log('- Keys:', Object.keys(data));

    // Extract following list like FollowContext does
    const following = Array.isArray(data) ? data : (data.data || []);
    console.log('\n👥 Following list:');
    console.log('- Count:', following.length);
    
    if (following.length > 0) {
      console.log('\n📝 First user structure:');
      console.log(JSON.stringify(following[0], null, 2));
      
      console.log('\n🔑 ID extraction test:');
      following.forEach((u, i) => {
        const id = String(u.id || u._id || u.userId || u.user_id);
        console.log(`  ${i + 1}. ${u.username || u.name || 'unknown'} -> ID: ${id}`);
      });
    } else {
      console.log('⚠️  Following list is EMPTY!');
      console.log('\nThis is why FollowContext shows 0 following.');
      console.log('The user is not following anyone according to the API.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugFollowContext();
