// Test reels with the correct username (capital I)
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testCorrectHarvinderReels() {
  console.log('🔍 Testing Reels with Correct Username');
  console.log('======================================');
  console.log('Correct username: Its.harvinder.05 (capital I)');
  console.log('Wrong username: its.harvinder.05 (lowercase i)');
  console.log('');
  
  try {
    // Test 1: Correct username (capital I)
    console.log('📋 Test 1: Reels for Its.harvinder.05 (CORRECT - capital I)');
    const correctResponse = await fetch(`${API_BASE}/api/reels?username=Its.harvinder.05`);
    console.log('Status:', correctResponse.status);
    
    if (correctResponse.ok) {
      const correctData = await correctResponse.json();
      console.log('Reels count:', correctData.data?.length || 0);
      
      if (correctData.data && correctData.data.length > 0) {
        console.log('✅ Reels found for correct username:');
        correctData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            owner: reel.user?.username,
            belongs_to_harvinder: reel.user?.username === 'Its.harvinder.05'
          });
        });
      } else {
        console.log('✅ No reels found for Its.harvinder.05 (this is correct if you have no reels)');
      }
    } else {
      console.log('Status indicates no reels or error');
    }
    
    // Test 2: Wrong username (lowercase i)
    console.log('\n📋 Test 2: Reels for its.harvinder.05 (WRONG - lowercase i)');
    const wrongResponse = await fetch(`${API_BASE}/api/reels?username=its.harvinder.05`);
    console.log('Status:', wrongResponse.status);
    
    if (wrongResponse.ok) {
      const wrongData = await wrongResponse.json();
      console.log('Reels count:', wrongData.data?.length || 0);
      console.log('❌ This should return 404 since lowercase username doesn\'t exist');
    } else {
      console.log('✅ Correctly returns error for non-existent lowercase username');
    }
    
    // Test 3: Harshit's reels (for comparison)
    console.log('\n📋 Test 3: Reels for its_harshit_01 (for comparison)');
    const harshitResponse = await fetch(`${API_BASE}/api/reels?username=its_harshit_01`);
    console.log('Status:', harshitResponse.status);
    
    if (harshitResponse.ok) {
      const harshitData = await harshitResponse.json();
      console.log('Reels count:', harshitData.data?.length || 0);
      
      if (harshitData.data && harshitData.data.length > 0) {
        console.log('✅ Harshit\'s reels:');
        harshitData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            owner: reel.user?.username
          });
        });
      }
    }
    
    console.log('\n🔧 SOLUTION:');
    console.log('============');
    console.log('1. Your actual username is: Its.harvinder.05 (capital I)');
    console.log('2. Check your mobile app login - make sure you\'re logged in as "Its.harvinder.05"');
    console.log('3. If the app is using "its.harvinder.05" (lowercase), that\'s the bug');
    console.log('4. The mobile app should fetch reels for "Its.harvinder.05", not "its.harvinder.05"');
    
    console.log('\n🏁 Correct Username Test Complete');
    console.log('=================================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCorrectHarvinderReels();