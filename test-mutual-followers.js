// Test mutual followers endpoint
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';
const EMAIL = 'hs8339952@gmail.com';
const PASSWORD = 'abc123';

async function testMutualFollowers() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, '(ID:', userId, ')');

    // Test 1: Get all following users (without mutual filter)
    console.log('\n📋 Test 1: Get all following users (no mutual filter)');
    const allFollowingResponse = await fetch(`${API_URL}/api/users/list?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (allFollowingResponse.ok) {
      const allFollowingData = await allFollowingResponse.json();
      const allUsers = allFollowingData.data?.users || allFollowingData.users || [];
      console.log(`✅ Found ${allUsers.length} following users:`);
      allUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.full_name})`);
      });
    } else {
      console.error('❌ Failed to fetch following users:', await allFollowingResponse.text());
    }

    // Test 2: Get mutual followers only
    console.log('\n📋 Test 2: Get mutual followers (mutual=true)');
    const mutualResponse = await fetch(`${API_URL}/api/users/list?limit=50&mutual=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (mutualResponse.ok) {
      const mutualData = await mutualResponse.json();
      const mutualUsers = mutualData.data?.users || mutualData.users || [];
      console.log(`✅ Found ${mutualUsers.length} mutual followers:`);
      mutualUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.full_name})`);
      });

      if (mutualUsers.length === 0) {
        console.log('\n⚠️  No mutual followers found. This could mean:');
        console.log('   1. You are not following anyone');
        console.log('   2. None of the people you follow are following you back');
        console.log('   3. There is a database field name mismatch');
      }
    } else {
      console.error('❌ Failed to fetch mutual followers:', await mutualResponse.text());
    }

    // Test 3: Check follows collection directly
    console.log('\n📋 Test 3: Checking follows collection structure...');
    console.log('(This would require direct database access)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMutualFollowers();
