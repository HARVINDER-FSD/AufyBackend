// Test Secret Crush Matches - Check if mutual matches are working
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testSecretCrushMatches() {
  console.log('🔍 Testing Secret Crush Matches...\n');

  try {
    // Test login first
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    if (!loginRes.ok) {
      console.log('❌ Login failed, using test token');
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Login successful');

    // Test 1: Get current crush list
    console.log('\n📋 Testing: Get My Crush List');
    const listRes = await fetch(`${API_URL}/api/secret-crush/my-list`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (listRes.ok) {
      const listData = await listRes.json();
      console.log('✅ Crush list retrieved:');
      console.log(`   Total crushes: ${listData.count}`);
      console.log(`   Mutual matches: ${listData.mutualCount}`);
      console.log(`   Max crushes: ${listData.maxCrushes}`);
      
      if (listData.crushes && listData.crushes.length > 0) {
        console.log('\n   Crushes:');
        listData.crushes.forEach((crush, index) => {
          console.log(`   ${index + 1}. @${crush.user.username} - ${crush.user.full_name}`);
          console.log(`      Mutual: ${crush.isMutual ? '💕 YES' : '❌ NO'}`);
          console.log(`      Chat ID: ${crush.chatId || 'None'}`);
          console.log(`      Added: ${new Date(crush.addedAt).toLocaleDateString()}`);
          if (crush.mutualSince) {
            console.log(`      Mutual Since: ${new Date(crush.mutualSince).toLocaleDateString()}`);
          }
          console.log('');
        });
      }
    } else {
      console.log('❌ Failed to get crush list');
    }

    // Test 2: Get only mutual crushes
    console.log('\n💕 Testing: Get Mutual Crushes Only');
    const mutualRes = await fetch(`${API_URL}/api/secret-crush/mutual`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (mutualRes.ok) {
      const mutualData = await mutualRes.json();
      console.log('✅ Mutual crushes retrieved:');
      console.log(`   Count: ${mutualData.count}`);
      
      if (mutualData.mutualCrushes && mutualData.mutualCrushes.length > 0) {
        console.log('\n   Mutual Matches:');
        mutualData.mutualCrushes.forEach((crush, index) => {
          console.log(`   ${index + 1}. @${crush.user.username} - ${crush.user.full_name}`);
          console.log(`      Chat ID: ${crush.chatId}`);
          console.log(`      Mutual Since: ${new Date(crush.mutualSince).toLocaleDateString()}`);
          console.log('');
        });
      } else {
        console.log('   No mutual matches found');
      }
    } else {
      console.log('❌ Failed to get mutual crushes');
    }

    // Test 3: Check specific user
    console.log('\n🔍 Testing: Check Specific User');
    // You can replace this with an actual user ID from your database
    const testUserId = '60f7b3b3b3b3b3b3b3b3b3b3'; // Replace with real user ID
    
    const checkRes = await fetch(`${API_URL}/api/secret-crush/check/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (checkRes.ok) {
      const checkData = await checkRes.json();
      console.log('✅ User check result:');
      console.log(`   In my list: ${checkData.isInMyList ? 'YES' : 'NO'}`);
      console.log(`   Is mutual: ${checkData.isMutual ? '💕 YES' : 'NO'}`);
      console.log(`   Chat ID: ${checkData.chatId || 'None'}`);
    } else {
      console.log('❌ Failed to check user');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSecretCrushMatches();