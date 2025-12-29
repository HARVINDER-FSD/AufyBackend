// Test the specific issue: Harshit's reel showing in Harvinder's profile
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testHarvinderReelIssue() {
  console.log('🔍 Testing Harvinder Reel Cross-Contamination Issue');
  console.log('==================================================');
  console.log('Problem: Harshit\'s reel (its_harshit_01) showing in Harvinder\'s profile (its.harvinder.05)');
  console.log('');
  
  try {
    // Test 1: What reels does Harvinder's profile get?
    console.log('📋 Test 1: Reels for its.harvinder.05 (YOUR profile)');
    const harvinderReelsResponse = await fetch(`${API_BASE}/api/reels?username=its.harvinder.05`);
    console.log('Status:', harvinderReelsResponse.status);
    
    if (harvinderReelsResponse.ok) {
      const harvinderReelsData = await harvinderReelsResponse.json();
      console.log('Reels count:', harvinderReelsData.data?.length || 0);
      
      if (harvinderReelsData.data && harvinderReelsData.data.length > 0) {
        console.log('\n❌ PROBLEM CONFIRMED: Reels found in Harvinder\'s profile:');
        harvinderReelsData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            actual_owner: reel.user?.username,
            should_be_in_harvinder_profile: reel.user?.username === 'its.harvinder.05',
            is_harshit_reel: reel.user?.username === 'its_harshit_01'
          });
          
          if (reel.user?.username === 'its_harshit_01') {
            console.log(`❌ CRITICAL: Harshit's reel ${reel.id} is in Harvinder's profile!`);
            console.log(`❌ This reel should ONLY appear in its_harshit_01's profile, not its.harvinder.05's profile`);
          }
        });
      } else {
        console.log('✅ Correct: No reels found in Harvinder\'s profile (as expected)');
      }
    } else {
      console.log('✅ Correct: API returns error for Harvinder (no reels)');
    }
    
    // Test 2: What reels does Harshit's profile get?
    console.log('\n📋 Test 2: Reels for its_harshit_01 (Harshit\'s profile - where the reel should be)');
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
    
    // Test 3: Check if Harvinder user exists
    console.log('\n📋 Test 3: Check Harvinder User Profile');
    const harvinderProfileResponse = await fetch(`${API_BASE}/api/users/username/its.harvinder.05`);
    console.log('Harvinder Profile Status:', harvinderProfileResponse.status);
    
    if (harvinderProfileResponse.ok) {
      const harvinderProfile = await harvinderProfileResponse.json();
      const harvinderUser = harvinderProfile.data || harvinderProfile;
      console.log('✅ Harvinder User Found:', {
        id: harvinderUser.id,
        username: harvinderUser.username,
        name: harvinderUser.name || harvinderUser.full_name,
        posts_count: harvinderUser.posts_count || 0
      });
    } else {
      console.log('❌ Harvinder user not found - this might be the issue!');
    }
    
    // Test 4: Check Harshit user
    console.log('\n📋 Test 4: Check Harshit User Profile');
    const harshitProfileResponse = await fetch(`${API_BASE}/api/users/username/its_harshit_01`);
    console.log('Harshit Profile Status:', harshitProfileResponse.status);
    
    if (harshitProfileResponse.ok) {
      const harshitProfile = await harshitProfileResponse.json();
      const harshitUser = harshitProfile.data || harshitProfile;
      console.log('✅ Harshit User Found:', {
        id: harshitUser.id,
        username: harshitUser.username,
        name: harshitUser.name || harshitUser.full_name,
        posts_count: harshitUser.posts_count || 0
      });
    }
    
    console.log('\n🔧 Issue Analysis:');
    console.log('If Harvinder gets Harshit\'s reel, the problem could be:');
    console.log('1. Backend reel filtering is broken');
    console.log('2. Mobile app is fetching wrong user\'s reels');
    console.log('3. Mobile app cache is corrupted');
    console.log('4. User session is mixed up');
    
    console.log('\n🔧 Immediate Fix Steps:');
    console.log('1. Clear mobile app cache completely');
    console.log('2. Logout and login again');
    console.log('3. Check which user you\'re actually logged in as');
    console.log('4. Test with fresh app install');
    
    console.log('\n🏁 Harvinder Reel Issue Test Complete');
    console.log('====================================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testHarvinderReelIssue();