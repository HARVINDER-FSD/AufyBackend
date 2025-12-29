// Check the exact username with different cases
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function checkExactUsername() {
  console.log('🔍 Checking Exact Username Cases');
  console.log('=================================');
  
  const variations = [
    'its.harvinder.05',      // lowercase
    'Its.harvinder.05',      // Capital I
    'ITS.HARVINDER.05',      // all caps
    'its_harshit_01',        // known working user
    'its_monu_0207'          // known working user
  ];
  
  console.log('📋 Testing exact username cases...\n');
  
  for (const username of variations) {
    try {
      console.log(`Testing: "${username}"`);
      const response = await fetch(`${API_BASE}/api/users/username/${username}`);
      
      if (response.status === 200) {
        const userData = await response.json();
        const user = userData.data || userData;
        console.log(`✅ FOUND: "${username}"`);
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Name: ${user.name || user.full_name || 'No name'}`);
        console.log(`   - Email: ${user.email || 'No email'}`);
        console.log(`   - Followers: ${user.followers_count || 0}`);
        console.log(`   - Following: ${user.following_count || 0}`);
        console.log('');
      } else {
        console.log(`❌ Not found: "${username}" (Status: ${response.status})`);
      }
    } catch (error) {
      console.log(`❌ Error checking "${username}": ${error.message}`);
    }
  }
  
  console.log('🏁 Username Case Check Complete');
  console.log('==============================');
}

// Run the check
checkExactUsername();