// Debug the reel ownership issue - find which user's reel is showing in wrong profile
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function debugReelOwnershipIssue() {
  console.log('🔍 Debugging Reel Ownership Issue');
  console.log('==================================');
  
  try {
    // Test 1: Check what reels its_harshit_01 is getting
    console.log('\n📋 Test 1: Reels for its_harshit_01 (your account)');
    const harshitReelsResponse = await fetch(`${API_BASE}/api/reels?username=its_harshit_01`);
    console.log('Status:', harshitReelsResponse.status);
    
    if (harshitReelsResponse.ok) {
      const harshitReelsData = await harshitReelsResponse.json();
      console.log('Reels count:', harshitReelsData.data?.length || 0);
      
      if (harshitReelsData.data && harshitReelsData.data.length > 0) {
        console.log('\n📊 Reels showing in its_harshit_01 profile:');
        harshitReelsData.data.forEach((reel, index) => {
          console.log(`Reel ${index + 1}:`, {
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            actual_owner: reel.user?.username,
            created_at: reel.created_at,
            is_correct_owner: reel.user?.username === 'its_harshit_01'
          });
          
          if (reel.user?.username !== 'its_harshit_01') {
            console.log(`❌ PROBLEM: This reel belongs to ${reel.user?.username}, not its_harshit_01!`);
          }
        });
      }
    }
    
    // Test 2: Check all reels in database to see ownership
    console.log('\n📋 Test 2: All reels in database');
    const allReelsResponse = await fetch(`${API_BASE}/api/reels`);
    console.log('Status:', allReelsResponse.status);
    
    if (allReelsResponse.ok) {
      const allReelsData = await allReelsResponse.json();
      console.log('Total reels in database:', allReelsData.data?.length || 0);
      
      if (allReelsData.data && allReelsData.data.length > 0) {
        console.log('\n📊 All reels ownership:');
        const ownershipMap = {};
        
        allReelsData.data.forEach((reel, index) => {
          const owner = reel.user?.username || 'unknown';
          if (!ownershipMap[owner]) {
            ownershipMap[owner] = [];
          }
          ownershipMap[owner].push({
            id: reel.id,
            title: reel.title || reel.description || 'No title',
            created_at: reel.created_at
          });
        });
        
        console.log('Reels by owner:');
        Object.keys(ownershipMap).forEach(owner => {
          console.log(`${owner}: ${ownershipMap[owner].length} reels`);
          ownershipMap[owner].forEach(reel => {
            console.log(`  - ${reel.id}: ${reel.title}`);
          });
        });
      }
    }
    
    // Test 3: Check specific users that might have reels
    const testUsers = ['its_monu_0207', 'krina_0207', 'test_user'];
    
    for (const username of testUsers) {
      console.log(`\n📋 Test 3.${testUsers.indexOf(username) + 1}: Reels for ${username}`);
      const userReelsResponse = await fetch(`${API_BASE}/api/reels?username=${username}`);
      console.log(`${username} Status:`, userReelsResponse.status);
      
      if (userReelsResponse.ok) {
        const userReelsData = await userReelsResponse.json();
        console.log(`${username} Reels count:`, userReelsData.data?.length || 0);
        
        if (userReelsData.data && userReelsData.data.length > 0) {
          userReelsData.data.forEach((reel, index) => {
            console.log(`${username} Reel ${index + 1}:`, {
              id: reel.id,
              actual_owner: reel.user?.username,
              is_correct: reel.user?.username === username
            });
          });
        }
      }
    }
    
    console.log('\n🏁 Reel Ownership Debug Complete');
    console.log('=================================');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugReelOwnershipIssue();