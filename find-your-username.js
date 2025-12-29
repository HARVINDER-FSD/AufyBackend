// Find the actual username of the user experiencing the issue
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function findYourUsername() {
  console.log('🔍 Finding Your Actual Username');
  console.log('===============================');
  
  try {
    // List all users to see who exists
    console.log('\n📋 All users in the system:');
    
    // Try to get all users (if endpoint exists)
    const usersResponse = await fetch(`${API_BASE}/api/users`);
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      const users = usersData.data || usersData.users || usersData;
      
      if (Array.isArray(users)) {
        console.log(`Found ${users.length} users:`);
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.username} (ID: ${user.id || user._id})`);
        });
      }
    } else {
      console.log('Cannot list all users, trying individual usernames...');
      
      // Try common usernames that might be yours
      const possibleUsernames = [
        'its_monu_0207',
        'monu_0207', 
        'krina_0207',
        'harvinder',
        'admin',
        'test_user',
        'user1',
        'demo_user'
      ];
      
      console.log('\nChecking possible usernames:');
      for (const username of possibleUsernames) {
        try {
          const userResponse = await fetch(`${API_BASE}/api/users/username/${username}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const user = userData.data || userData;
            console.log(`✅ Found: ${user.username} (ID: ${user.id})`);
            
            // Check if this user has any reels
            const reelsResponse = await fetch(`${API_BASE}/api/reels?username=${username}`);
            if (reelsResponse.ok) {
              const reelsData = await reelsResponse.json();
              console.log(`   - Has ${reelsData.data?.length || 0} reels`);
              
              if (reelsData.data && reelsData.data.length > 0) {
                reelsData.data.forEach(reel => {
                  console.log(`   - Reel: ${reel.id} (owner: ${reel.user?.username})`);
                  if (reel.user?.username !== username) {
                    console.log(`     ❌ PROBLEM: This reel belongs to ${reel.user?.username}, not ${username}!`);
                  }
                });
              }
            }
          }
        } catch (error) {
          // User doesn't exist, continue
        }
      }
    }
    
    console.log('\n📋 Reel ownership analysis:');
    console.log('The reel 693e7712e109674a7d1e2d8b belongs to: its_harshit_01');
    console.log('But it\'s showing in YOUR profile instead.');
    console.log('');
    console.log('Please tell me:');
    console.log('1. What is YOUR username in the app?');
    console.log('2. When you open YOUR profile, you see Harshit\'s reel there?');
    console.log('3. When you tap on the reel, whose name/profile shows?');
    
    console.log('\n🏁 Username Search Complete');
    console.log('===========================');
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
  }
}

// Run the search
findYourUsername();