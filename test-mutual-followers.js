const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';
const USER_EMAIL = 'hs8339952@gmail.com';
const USER_PASSWORD = 'abc123';

async function testMutualFollowers() {
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

    // Get mutual followers
    console.log('\n👥 Fetching mutual followers...');
    const followersResponse = await fetch(`${API_BASE}/api/users/${userId}/mutual-followers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!followersResponse.ok) {
      const errorText = await followersResponse.text();
      console.error('❌ Failed to fetch mutual followers:', followersResponse.status, errorText);
      return;
    }

    const followersData = await followersResponse.json();
    const followers = followersData.data || followersData || [];

    console.log('\n📈 MUTUAL FOLLOWERS SUMMARY:');
    console.log('═══════════════════════════════');
    console.log(`👥 Total Mutual Followers: ${followers.length}`);

    if (followers.length > 0) {
      console.log('\n👥 AVAILABLE TO ADD AS SECRET CRUSHES:');
      console.log('─────────────────────────────────────────');
      followers.forEach((follower, index) => {
        console.log(`${index + 1}. @${follower.username}`);
        console.log(`   Full Name: ${follower.full_name || follower.fullName || 'Not provided'}`);
        console.log(`   User ID: ${follower._id || follower.id}`);
        console.log(`   Profile Image: ${follower.avatar_url || follower.profileImage || follower.avatar || 'None'}`);
        console.log('');
      });

      console.log('💡 NEXT STEPS:');
      console.log('1. Go to Settings > Favorites Friend in the app');
      console.log('2. Tap the star icon next to users you like');
      console.log('3. If they add you back, you\'ll get a mutual match! 💕');
      console.log('4. Mutual matches will show the heart icon in Messages');
    } else {
      console.log('\n😔 NO MUTUAL FOLLOWERS FOUND');
      console.log('─────────────────────────────');
      console.log('💡 To get mutual followers:');
      console.log('1. Follow other users');
      console.log('2. Get them to follow you back');
      console.log('3. They will then appear in your mutual followers list');
    }

    // Test adding a user (if available)
    if (followers.length > 0) {
      const testUser = followers[0];
      console.log(`\n🧪 TEST: Adding @${testUser.username} to secret crushes...`);
      
      const addResponse = await fetch(`${API_BASE}/api/secret-crush/add/${testUser._id || testUser.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (addResponse.ok) {
        const addData = await addResponse.json();
        console.log('✅ Successfully added to secret crushes!');
        console.log('📊 Response:', JSON.stringify(addData, null, 2));
        
        if (addData.isMutual) {
          console.log('🎉 MUTUAL MATCH! They already added you too!');
        } else {
          console.log('⭐ Added successfully. Waiting for them to add you back for a mutual match.');
        }

        // Now check the updated list
        console.log('\n🔄 Checking updated secret crush list...');
        const updatedCrushResponse = await fetch(`${API_BASE}/api/secret-crush/my-list`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (updatedCrushResponse.ok) {
          const updatedCrushData = await updatedCrushResponse.json();
          const updatedCrushes = updatedCrushData.crushes || [];
          const updatedMutualCount = updatedCrushes.filter(c => c.isMutual).length;
          
          console.log('📊 UPDATED STATUS:');
          console.log(`📝 Total Secret Crushes: ${updatedCrushes.length}`);
          console.log(`💕 Mutual Matches: ${updatedMutualCount}`);
          console.log(`Heart Icon Should Show: ${updatedMutualCount > 0 ? '✅ YES' : '❌ NO'}`);
        }
      } else {
        const errorText = await addResponse.text();
        console.log('❌ Failed to add to secret crushes:', addResponse.status, errorText);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testMutualFollowers();