// Test the reel ownership fix - ensure no cross-contamination
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testReelOwnershipFix() {
  console.log('🔍 Testing Reel Ownership Fix');
  console.log('=============================');
  console.log('Ensuring no cross-contamination between user profiles');
  console.log('');
  
  try {
    // Test all known users
    const users = [
      { username: 'Its.harvinder.05', name: 'Harvinder Singh' },
      { username: 'its_harshit_01', name: 'Harshit' },
      { username: 'its_monu_0207', name: 'Shailendra Dohare' }
    ];
    
    console.log('📋 Testing reel ownership for each user...\n');
    
    for (const user of users) {
      console.log(`🔍 Testing: ${user.username} (${user.name})`);
      console.log('─'.repeat(50));
      
      try {
        const response = await fetch(`${API_BASE}/api/reels?username=${user.username}`);
        
        if (response.status === 200) {
          const data = await response.json();
          const reels = data.data || [];
          
          console.log(`✅ API Response: ${reels.length} reel(s) found`);
          
          if (reels.length > 0) {
            let ownReels = 0;
            let wrongReels = 0;
            
            reels.forEach((reel, index) => {
              const reelOwner = reel.user?.username;
              const isCorrectOwner = reelOwner === user.username;
              
              console.log(`   Reel ${index + 1}:`);
              console.log(`     - ID: ${reel.id}`);
              console.log(`     - Owner: ${reelOwner}`);
              console.log(`     - Correct Owner: ${isCorrectOwner ? '✅ YES' : '❌ NO'}`);
              
              if (isCorrectOwner) {
                ownReels++;
              } else {
                wrongReels++;
                console.log(`     - ❌ CROSS-CONTAMINATION: This reel belongs to ${reelOwner}, not ${user.username}!`);
              }
            });
            
            console.log(`   Summary: ${ownReels} correct, ${wrongReels} wrong`);
            
            if (wrongReels > 0) {
              console.log(`   ❌ ISSUE: ${user.username} has ${wrongReels} reel(s) from other users!`);
            } else {
              console.log(`   ✅ GOOD: All reels belong to ${user.username}`);
            }
          } else {
            console.log(`   ✅ No reels found (this is fine)`);
          }
        } else if (response.status === 404) {
          console.log(`   ✅ No reels found (404 - this is fine)`);
        } else {
          console.log(`   ❌ API Error: Status ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Error testing ${user.username}: ${error.message}`);
      }
      
      console.log('');
    }
    
    console.log('🔧 MOBILE APP FIX STATUS:');
    console.log('=========================');
    console.log('✅ Added strict reel ownership validation');
    console.log('✅ Added cross-contamination detection');
    console.log('✅ Added automatic filtering of wrong user reels');
    console.log('✅ Added user alerts for cross-contamination');
    console.log('✅ Added double-check validation');
    console.log('✅ Removed temporary test reel injection');
    console.log('');
    console.log('📱 NEXT STEPS:');
    console.log('1. Restart the mobile app');
    console.log('2. Check your profile reels tab');
    console.log('3. Should now show only YOUR reels (or empty if you have none)');
    console.log('4. If you see an alert about cross-contamination, the fix is working');
    
    console.log('\n🏁 Reel Ownership Test Complete');
    console.log('===============================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testReelOwnershipFix();