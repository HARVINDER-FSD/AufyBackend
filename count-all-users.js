// Count all users in the database
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function countAllUsers() {
  console.log('📊 Counting All Users in Database');
  console.log('=================================');
  
  try {
    // Try to get user count from a stats endpoint or search
    const response = await fetch(`${API_BASE}/api/users/search?q=`);
    
    if (response.ok) {
      const data = await response.json();
      const users = data.users || data.data || [];
      console.log(`✅ Total users found: ${users.length}`);
      
      if (users.length > 0) {
        console.log('\n📋 User List:');
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.username} (${user.name || 'No name'}) - ID: ${user.id}`);
        });
      }
    } else {
      console.log('❌ Could not fetch user count from search endpoint');
      
      // Try individual known users
      console.log('\n📋 Checking known users individually:');
      const knownUsers = ['Its.harvinder.05', 'its_harshit_01', 'its_monu_0207'];
      let foundCount = 0;
      
      for (const username of knownUsers) {
        try {
          const userResponse = await fetch(`${API_BASE}/api/users/username/${username}`);
          if (userResponse.status === 200) {
            const userData = await userResponse.json();
            const user = userData.data || userData;
            console.log(`✅ ${username} - ${user.name || 'No name'}`);
            foundCount++;
          }
        } catch (error) {
          // Skip errors
        }
      }
      
      console.log(`\n📊 Found ${foundCount} known users`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n🏁 User Count Complete');
  console.log('======================');
}

// Run the count
countAllUsers();