// Test Secret Crush Heart Icon - Verify mutual matches show heart icons
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testSecretCrushHeartIcon() {
  console.log('💕 Testing Secret Crush Heart Icon Display...\n');

  try {
    // Test with a real user login
    console.log('🔐 Attempting login...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', // Replace with real test email
        password: 'password123'     // Replace with real test password
      })
    });

    if (!loginRes.ok) {
      console.log('❌ Login failed. Please check credentials.');
      console.log('   Make sure you have a test user account set up.');
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Login successful');

    // Test 1: Get current crush list with detailed info
    console.log('\n📋 Getting crush list with match details...');
    const listRes = await fetch(`${API_URL}/api/secret-crush/my-list`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (listRes.ok) {
      const listData = await listRes.json();
      console.log('✅ Crush list retrieved successfully');
      console.log(`   Total crushes: ${listData.count}`);
      console.log(`   Mutual matches: ${listData.mutualCount}`);
      console.log(`   Max crushes allowed: ${listData.maxCrushes}`);
      console.log(`   Premium user: ${listData.isPremium ? 'Yes' : 'No'}`);
      
      if (listData.crushes && listData.crushes.length > 0) {
        console.log('\n   📝 Detailed crush list:');
        listData.crushes.forEach((crush, index) => {
          const heartIcon = crush.isMutual ? '💕' : '⭐';
          const mutualStatus = crush.isMutual ? 'MUTUAL MATCH' : 'One-sided';
          
          console.log(`   ${index + 1}. ${heartIcon} @${crush.user.username} - ${crush.user.full_name}`);
          console.log(`      Status: ${mutualStatus}`);
          console.log(`      Added: ${new Date(crush.addedAt).toLocaleDateString()}`);
          
          if (crush.isMutual) {
            console.log(`      💬 Chat ID: ${crush.chatId}`);
            if (crush.mutualSince) {
              console.log(`      💕 Mutual since: ${new Date(crush.mutualSince).toLocaleDateString()}`);
            }
            console.log('      🎯 UI should show: SparkleHeart icon (pink heart with sparkles)');
          } else {
            console.log('      🎯 UI should show: Star icon (gold if added, gray if not)');
          }
          console.log('');
        });

        // Check if there are mutual matches for heart icon display
        const mutualMatches = listData.crushes.filter(c => c.isMutual);
        if (mutualMatches.length > 0) {
          console.log(`\n💕 HEART ICON TEST RESULTS:`);
          console.log(`   Found ${mutualMatches.length} mutual match(es) that should display heart icons`);
          console.log(`   These users should show SparkleHeart component instead of Star:`);
          mutualMatches.forEach((match, index) => {
            console.log(`   ${index + 1}. @${match.user.username} - Should show 💕 SparkleHeart`);
          });
        } else {
          console.log(`\n⭐ NO MUTUAL MATCHES FOUND`);
          console.log(`   All crushes should show Star icons only`);
          console.log(`   To test heart icons, you need mutual matches:`);
          console.log(`   1. Add someone as a crush`);
          console.log(`   2. Have them add you back as a crush`);
          console.log(`   3. Both will then show heart icons`);
        }
      } else {
        console.log('\n   📝 No crushes found');
        console.log('   Add some crushes to test the heart icon functionality');
      }
    } else {
      console.log('❌ Failed to get crush list');
      const errorData = await listRes.json().catch(() => ({}));
      console.log('   Error:', errorData.message || 'Unknown error');
    }

    // Test 2: Get only mutual crushes (these should all show heart icons)
    console.log('\n💕 Getting mutual crushes only...');
    const mutualRes = await fetch(`${API_URL}/api/secret-crush/mutual`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (mutualRes.ok) {
      const mutualData = await mutualRes.json();
      console.log('✅ Mutual crushes retrieved');
      console.log(`   Count: ${mutualData.count}`);
      
      if (mutualData.mutualCrushes && mutualData.mutualCrushes.length > 0) {
        console.log('\n   💕 All these should show SparkleHeart icons:');
        mutualData.mutualCrushes.forEach((crush, index) => {
          console.log(`   ${index + 1}. 💕 @${crush.user.username} - ${crush.user.full_name}`);
          console.log(`      Chat ID: ${crush.chatId}`);
          console.log(`      Mutual since: ${new Date(crush.mutualSince).toLocaleDateString()}`);
        });
      } else {
        console.log('   No mutual matches found');
      }
    } else {
      console.log('❌ Failed to get mutual crushes');
    }

    // Test 3: UI Component Test Instructions
    console.log('\n🎯 UI COMPONENT TEST INSTRUCTIONS:');
    console.log('   1. Open the Secret Crush screen in your app');
    console.log('   2. Look for users in your crush list');
    console.log('   3. Users with isMutual: true should show:');
    console.log('      - SparkleHeart icon (pink heart with sparkles)');
    console.log('      - "💕 Mutual Match!" text under their name');
    console.log('      - Pink highlight in the mutual matches section');
    console.log('   4. Users with isMutual: false should show:');
    console.log('      - Star icon (gold if in your list, gray if not)');
    console.log('      - No special text or highlighting');

    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('   If heart icons are not showing:');
    console.log('   1. Check that crushData is properly loaded');
    console.log('   2. Verify isMutual field is true in the API response');
    console.log('   3. Ensure SparkleHeart component is imported correctly');
    console.log('   4. Check that the renderUser function finds the mutual match');
    console.log('   5. Restart the app to refresh the data');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Common issues:');
    console.log('   - Check API URL is correct');
    console.log('   - Verify test user credentials');
    console.log('   - Ensure backend is running');
    console.log('   - Check network connection');
  }
}

// Run the test
testSecretCrushHeartIcon();