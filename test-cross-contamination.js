// Test the cross-contamination issue - Harshit's reel showing in Monu's profile
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testCrossContamination() {
  console.log('🔍 Testing Cross-Contamination Issue');
  console.log('====================================');
  console.log('Problem: Harshit\'s reel showing in Monu\'s profile');
  console.log('');
  
  try {
    // Test 1: What reels does Monu's profile get?
    console.log('📋 Test 1: Reels for its_monu_0207 (YOUR profile)');
    const monuReelsResponse = await fetch(`${API_BASE}/api/reels?username=its_monu_0207`);
    console.log('Status:', monuReelsResponse.status);
    
    if (monuReelsResponse.ok) {
      const monuReelsData = await monuReelsResponse.json();
      console.log('Reels count:', monuReelsData.data?.length || 0);
      
      if (monuReelsData.data && monuReelsData.data.length > 0) {
        console.log('\n❌ PROBLEM CONFIRMED: Reels found in Monu\'s profile:');
        monuReelsData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            actual_owner: reel.user?.username,
            should_be_in_monu_profile: reel.user?.username === 'its_monu_0207',
            is_harshit_reel: reel.user?.username === 'its_harshit_01'
          });
          
          if (reel.user?.username === 'its_harshit_01') {
            console.log(`❌ CRITICAL: Harshit's reel ${reel.id} is in Monu's profile!`);
          }
        });
      } else {
        console.log('✅ Correct: No reels found in Monu\'s profile (as expected)');
      }
    } else {
      console.log('✅ Correct: API returns error for Monu (no reels)');
    }
    
    // Test 2: What reels does Harshit's profile get?
    console.log('\n📋 Test 2: Reels for its_harshit_01 (Harshit\'s profile)');
    const harshitReelsResponse = await fetch(`${API_BASE}/api/reels?username=its_harshit_01`);
    console.log('Status:', harshitReelsResponse.status);
    
    if (harshitReelsResponse.ok) {
      const harshitReelsData = await harshitReelsResponse.json();
      console.log('Reels count:', harshitReelsData.data?.length || 0);
      
      if (harshitReelsData.data && harshitReelsData.data.length > 0) {
        console.log('\n✅ Correct: Reels found in Harshit\'s profile:');
        harshitReelsData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            actual_owner: reel.user?.username,
            correctly_in_harshit_profile: reel.user?.username === 'its_harshit_01'
          });
        });
      }
    }
    
    // Test 3: Check backend reel service logic
    console.log('\n📋 Test 3: Backend Logic Analysis');
    console.log('The backend should filter reels by username in the query.');
    console.log('If Monu gets Harshit\'s reel, there\'s a backend filtering issue.');
    
    // Test 4: Check if there's a user ID mixup
    console.log('\n📋 Test 4: User ID Check');
    
    const monuProfileResponse = await fetch(`${API_BASE}/api/users/username/its_monu_0207`);
    if (monuProfileResponse.ok) {
      const monuProfile = await monuProfileResponse.json();
      const monuUser = monuProfile.data || monuProfile;
      console.log('Monu\'s user ID:', monuUser.id);
    }
    
    const harshitProfileResponse = await fetch(`${API_BASE}/api/users/username/its_harshit_01`);
    if (harshitProfileResponse.ok) {
      const harshitProfile = await harshitProfileResponse.json();
      const harshitUser = harshitProfile.data || harshitProfile;
      console.log('Harshit\'s user ID:', harshitUser.id);
    }
    
    console.log('\n🔧 Recommended Fix:');
    console.log('1. Check backend reel filtering logic');
    console.log('2. Ensure mobile app validates reel ownership');
    console.log('3. Clear mobile app cache completely');
    console.log('4. Test with fresh login');
    
    console.log('\n🏁 Cross-Contamination Test Complete');
    console.log('====================================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCrossContamination();