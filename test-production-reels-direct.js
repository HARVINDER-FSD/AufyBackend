// Test production reels endpoint directly to verify backend behavior
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testReelsEndpoint() {
  console.log('🧪 Testing Production Reels Endpoint');
  console.log('=====================================');
  
  try {
    // Test 1: Check reels for its_harshit_01 (should have reels)
    console.log('\n📋 Test 1: Reels for its_harshit_01');
    const response1 = await fetch(`${API_BASE}/api/reels?username=its_harshit_01`);
    console.log('Status:', response1.status);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('Response structure:', Object.keys(data1));
      console.log('Reels count:', data1.data?.length || 0);
      
      if (data1.data && data1.data.length > 0) {
        console.log('First reel owner:', data1.data[0].user?.username);
        console.log('All reel owners:', data1.data.map(r => r.user?.username));
        
        // Check if all reels belong to the requested user
        const wrongOwners = data1.data.filter(r => r.user?.username !== 'its_harshit_01');
        if (wrongOwners.length > 0) {
          console.log('❌ PROBLEM: Found reels from other users:', wrongOwners.map(r => r.user?.username));
        } else {
          console.log('✅ All reels belong to its_harshit_01');
        }
      } else {
        console.log('ℹ️ No reels found for its_harshit_01');
      }
    } else {
      console.log('❌ Request failed:', await response1.text());
    }
    
    // Test 2: Check reels for its_monu_0207 (might have different results)
    console.log('\n📋 Test 2: Reels for its_monu_0207');
    const response2 = await fetch(`${API_BASE}/api/reels?username=its_monu_0207`);
    console.log('Status:', response2.status);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('Reels count:', data2.data?.length || 0);
      
      if (data2.data && data2.data.length > 0) {
        console.log('All reel owners:', data2.data.map(r => r.user?.username));
        
        // Check if all reels belong to the requested user
        const wrongOwners = data2.data.filter(r => r.user?.username !== 'its_monu_0207');
        if (wrongOwners.length > 0) {
          console.log('❌ PROBLEM: Found reels from other users:', wrongOwners.map(r => r.user?.username));
        } else {
          console.log('✅ All reels belong to its_monu_0207');
        }
      } else {
        console.log('ℹ️ No reels found for its_monu_0207');
      }
    } else {
      console.log('❌ Request failed:', await response2.text());
    }
    
    // Test 3: Check reels for nonexistent user (should return 404 or empty)
    console.log('\n📋 Test 3: Reels for nonexistent_user_12345');
    const response3 = await fetch(`${API_BASE}/api/reels?username=nonexistent_user_12345`);
    console.log('Status:', response3.status);
    
    if (response3.ok) {
      const data3 = await response3.json();
      console.log('Reels count:', data3.data?.length || 0);
      if (data3.data?.length === 0) {
        console.log('✅ Correctly returns empty for nonexistent user');
      } else {
        console.log('❌ PROBLEM: Returns reels for nonexistent user');
      }
    } else {
      console.log('✅ Correctly returns error for nonexistent user');
    }
    
    console.log('\n🏁 Backend Testing Complete');
    console.log('============================');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testReelsEndpoint();