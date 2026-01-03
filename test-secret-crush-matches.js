const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';
const USER_EMAIL = 'hs8339952@gmail.com';
const USER_PASSWORD = 'abc123';

async function testSecretCrushMatches() {
  try {
    console.log('🔐 Logging in...');
    
    // Login first
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: USER_EMAIL,
        password: USER_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', loginResponse.status, errorText);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id || loginData.user._id;
    
    console.log('✅ Login successful');
    console.log('👤 User ID:', userId);
    console.log('👤 Username:', loginData.user.username);

    // Get secret crush list
    console.log('\n💕 Fetching secret crush list...');
    const crushResponse = await fetch(`${API_BASE}/api/secret-crush/my-list`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!crushResponse.ok) {
      const errorText = await crushResponse.text();
      console.error('❌ Failed to fetch secret crush list:', crushResponse.status, errorText);
      return;
    }

    const crushData = await crushResponse.json();
    console.log('📊 Raw API Response:', JSON.stringify(crushData, null, 2));

    const crushes = crushData.crushes || [];
    const totalCrushes = crushes.length;
    const mutualMatches = crushes.filter(crush => crush.isMutual);
    const mutualCount = mutualMatches.length;

    console.log('\n📈 SECRET CRUSH SUMMARY:');
    console.log('═══════════════════════════');
    console.log(`📝 Total Secret Crushes: ${totalCrushes}`);
    console.log(`💕 Mutual Matches: ${mutualCount}`);
    console.log(`📊 Match Rate: ${totalCrushes > 0 ? Math.round((mutualCount / totalCrushes) * 100) : 0}%`);

    if (totalCrushes > 0) {
      console.log('\n👥 ALL SECRET CRUSHES:');
      console.log('─────────────────────────');
      crushes.forEach((crush, index) => {
        const user = crush.user;
        const status = crush.isMutual ? '💕 MUTUAL MATCH' : '⭐ One-sided';
        console.log(`${index + 1}. @${user.username} (${user.fullName || user.full_name || 'No name'}) - ${status}`);
        console.log(`   User ID: ${user._id || user.id}`);
        console.log(`   Added: ${new Date(crush.addedAt).toLocaleDateString()}`);
        if (crush.isMutual && crush.mutualSince) {
          console.log(`   Mutual Since: ${new Date(crush.mutualSince).toLocaleDateString()}`);
        }
        if (crush.chatId) {
          console.log(`   Chat ID: ${crush.chatId}`);
        }
        console.log('');
      });
    }

    if (mutualCount > 0) {
      console.log('\n💕 MUTUAL MATCHES DETAILS:');
      console.log('═══════════════════════════');
      mutualMatches.forEach((match, index) => {
        const user = match.user;
        console.log(`${index + 1}. @${user.username}`);
        console.log(`   Full Name: ${user.fullName || user.full_name || 'Not provided'}`);
        console.log(`   User ID: ${user._id || user.id}`);
        console.log(`   Profile Image: ${user.profileImage || user.avatar_url || user.avatar || 'None'}`);
        console.log(`   Match ID: ${match.id}`);
        console.log(`   Added: ${new Date(match.addedAt).toLocaleDateString()}`);
        console.log(`   Mutual Since: ${new Date(match.mutualSince).toLocaleDateString()}`);
        if (match.chatId) {
          console.log(`   Chat Available: Yes (${match.chatId})`);
        } else {
          console.log(`   Chat Available: No`);
        }
        console.log('');
      });

      console.log('🎉 CONGRATULATIONS! You have mutual matches!');
      console.log('💬 You can now chat with these users in the Messages app.');
      console.log('💡 Look for the heart icon in the Messages header to access mutual matches.');
    } else {
      console.log('\n💔 NO MUTUAL MATCHES FOUND');
      console.log('───────────────────────────');
      if (totalCrushes > 0) {
        console.log('😔 Your crushes haven\'t added you back yet.');
        console.log('💪 Keep being awesome! They might add you soon.');
      } else {
        console.log('🤔 You haven\'t added anyone to your secret crush list yet.');
        console.log('💡 Go to Settings > Favorites Friend to add people you like!');
      }
    }

    // Test heart icon visibility logic
    console.log('\n🔍 HEART ICON VISIBILITY TEST:');
    console.log('═══════════════════════════════');
    const shouldShowHeartIcon = mutualCount > 0;
    console.log(`Heart Icon Should Show: ${shouldShowHeartIcon ? '✅ YES' : '❌ NO'}`);
    console.log(`Heart Icon Count: ${mutualCount}`);
    
    if (shouldShowHeartIcon) {
      console.log('💡 The heart icon should be visible in Messages header with count:', mutualCount);
    } else {
      console.log('💡 The heart icon should be hidden in Messages header');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testSecretCrushMatches();