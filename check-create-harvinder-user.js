// Check if Harvinder user exists and create if needed
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function checkAndCreateHarvinderUser() {
  console.log('🔍 Checking Harvinder User Status');
  console.log('==================================');
  
  try {
    // Check if user exists
    console.log('📋 Checking if its.harvinder.05 exists...');
    const checkResponse = await fetch(`${API_BASE}/api/users/username/its.harvinder.05`);
    console.log('Status:', checkResponse.status);
    
    if (checkResponse.status === 200) {
      const userData = await checkResponse.json();
      console.log('✅ User exists:', userData.data || userData);
      return;
    }
    
    if (checkResponse.status === 404) {
      console.log('❌ User its.harvinder.05 does NOT exist in database');
      console.log('');
      console.log('🔧 SOLUTION REQUIRED:');
      console.log('You need to either:');
      console.log('1. Register a new account with username "its.harvinder.05"');
      console.log('2. Or login with an existing username');
      console.log('');
      console.log('The cross-contamination happens because:');
      console.log('- You think you\'re logged in as "its.harvinder.05"');
      console.log('- But that user doesn\'t exist in the database');
      console.log('- So the app might be showing data from another user');
      console.log('');
      console.log('📱 IMMEDIATE ACTIONS:');
      console.log('1. Open the mobile app');
      console.log('2. Go to Settings > Account');
      console.log('3. Check what username is actually shown');
      console.log('4. If it shows "its.harvinder.05", logout and register this username');
      console.log('5. If it shows a different username, that\'s your actual account');
      console.log('');
      
      // Let's also check what users DO exist
      console.log('📋 Checking existing users...');
      const existingUsers = ['its_harshit_01', 'its_monu_0207', 'krina', 'harvinder', 'its.harvinder.05'];
      
      for (const username of existingUsers) {
        try {
          const userResponse = await fetch(`${API_BASE}/api/users/username/${username}`);
          if (userResponse.status === 200) {
            const userData = await userResponse.json();
            const user = userData.data || userData;
            console.log(`✅ ${username} exists (ID: ${user.id})`);
          } else {
            console.log(`❌ ${username} does not exist`);
          }
        } catch (error) {
          console.log(`❌ ${username} - error checking`);
        }
      }
    }
    
    console.log('\n🏁 User Check Complete');
    console.log('======================');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkAndCreateHarvinderUser();