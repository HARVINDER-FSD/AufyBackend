// Check all possible Harvinder username variations
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function checkAllHarvinderVariations() {
  console.log('🔍 Checking All Harvinder Username Variations');
  console.log('==============================================');
  
  const variations = [
    'its.harvinder.05',
    'its_harvinder_05', 
    'harvinder',
    'harvinder05',
    'its.harvinder05',
    'its_harvinder05',
    'harvindersingh',
    'harvinder.singh',
    'harvinder_singh'
  ];
  
  console.log('📋 Testing username variations...\n');
  
  let foundUsers = [];
  
  for (const username of variations) {
    try {
      console.log(`Checking: ${username}`);
      const response = await fetch(`${API_BASE}/api/users/username/${username}`);
      
      if (response.status === 200) {
        const userData = await response.json();
        const user = userData.data || userData;
        console.log(`✅ FOUND: ${username} (ID: ${user.id})`);
        foundUsers.push({ username, id: user.id, name: user.name || user.full_name });
      } else {
        console.log(`❌ Not found: ${username}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${username}: ${error.message}`);
    }
  }
  
  console.log('\n📊 RESULTS:');
  console.log('===========');
  
  if (foundUsers.length > 0) {
    console.log('✅ Found existing Harvinder accounts:');
    foundUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.name}) - ID: ${user.id}`);
    });
    console.log('\n🔧 SOLUTION:');
    console.log('You should login with one of the existing accounts above.');
    console.log('The cross-contamination happens because you\'re trying to use a non-existent username.');
  } else {
    console.log('❌ No Harvinder accounts found in any variation.');
    console.log('\n🔧 SOLUTION:');
    console.log('You need to register a new account with username "its.harvinder.05"');
    console.log('Run: node api-server/register-harvinder-user.js');
  }
  
  console.log('\n🏁 Username Variation Check Complete');
  console.log('===================================');
}

// Run the check
checkAllHarvinderVariations();