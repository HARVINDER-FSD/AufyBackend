// Test adding a favorite friend via API
const axios = require('axios');
require('dotenv').config();

// Try deployed URL first, then local
const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testAddFavorite() {
  try {
    console.log('🧪 TESTING ADD FAVORITE FRIEND\n');
    console.log('================================\n');

    // Step 1: Login as user 1
    console.log('1️⃣  Logging in as Its.harvinder.05...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    }).catch(err => {
      console.log('❌ Login failed:', err.response?.data || err.message);
      return null;
    });

    if (!loginRes || !loginRes.data.token) {
      console.log('❌ Could not login. Please check credentials.');
      return;
    }

    const token = loginRes.data.token;
    const userId = loginRes.data.user.id;
    console.log('✅ Logged in successfully');
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${token.substring(0, 20)}...`);

    // Step 2: Get mutual followers
    console.log('\n2️⃣  Fetching mutual followers...');
    const followersRes = await axios.get(`${API_URL}/api/users/${userId}/mutual-followers`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => {
      console.log('⚠️  Could not fetch mutual followers:', err.response?.data || err.message);
      return null;
    });

    if (followersRes && followersRes.data) {
      const followers = followersRes.data.data || followersRes.data || [];
      console.log(`✅ Found ${followers.length} mutual followers`);
      if (followers.length > 0) {
        followers.forEach((f, i) => {
          console.log(`   ${i + 1}. ${f.username} (${f._id || f.id})`);
        });
      }
    }

    // Step 3: Get current favorites list
    console.log('\n3️⃣  Fetching current favorites list...');
    const listRes = await axios.get(`${API_URL}/api/secret-crush/my-list`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => {
      console.log('❌ Could not fetch favorites:', err.response?.data || err.message);
      return null;
    });

    if (listRes && listRes.data) {
      console.log(`✅ Current favorites: ${listRes.data.count}/${listRes.data.maxCrushes}`);
      console.log(`   Premium: ${listRes.data.isPremium}`);
      if (listRes.data.crushes && listRes.data.crushes.length > 0) {
        listRes.data.crushes.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.user?.username || 'Unknown'} (Mutual: ${c.isMutual})`);
        });
      } else {
        console.log('   (No favorites yet)');
      }
    }

    // Step 4: Try to add a favorite
    // Using krinaprajapati24's ID
    const targetUserId = '693027231dc71aa588c1023e';
    const targetUsername = 'krinaprajapati24';

    console.log(`\n4️⃣  Attempting to add ${targetUsername} to favorites...`);
    console.log(`   Target User ID: ${targetUserId}`);

    const addRes = await axios.post(
      `${API_URL}/api/secret-crush/add/${targetUserId}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).catch(err => {
      console.log('❌ ADD FAILED!');
      console.log('   Status:', err.response?.status);
      console.log('   Error:', err.response?.data);
      return null;
    });

    if (addRes && addRes.data) {
      console.log('✅ ADD SUCCESSFUL!');
      console.log('   Response:', JSON.stringify(addRes.data, null, 2));
    }

    // Step 5: Verify it was added
    console.log('\n5️⃣  Verifying favorites list...');
    const verifyRes = await axios.get(`${API_URL}/api/secret-crush/my-list`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => {
      console.log('❌ Could not verify:', err.response?.data || err.message);
      return null;
    });

    if (verifyRes && verifyRes.data) {
      console.log(`✅ Updated favorites: ${verifyRes.data.count}/${verifyRes.data.maxCrushes}`);
      if (verifyRes.data.crushes && verifyRes.data.crushes.length > 0) {
        verifyRes.data.crushes.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.user?.username || 'Unknown'} (Mutual: ${c.isMutual})`);
        });
      }
    }

    console.log('\n✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testAddFavorite();
