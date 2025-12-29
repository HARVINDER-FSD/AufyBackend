// Test specific user reels to verify the issue
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function testSpecificUserReels() {
  console.log('🔍 Testing Specific User Reels');
  console.log('===============================');
  
  try {
    // First, wake up the backend
    console.log('⏰ Waking up backend...');
    const wakeResponse = await fetch(`${API_BASE}/api/health`);
    console.log('Wake status:', wakeResponse.status);
    
    // Wait a moment for backend to fully wake up
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test the reels endpoint with different approaches
    console.log('\n📋 Testing reels endpoint variations:');
    
    // Test 1: Direct reels endpoint
    console.log('\n1. Testing /api/reels?username=its_harshit_01');
    const response1 = await fetch(`${API_BASE}/api/reels?username=its_harshit_01`);
    console.log('Status:', response1.status);
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('Response:', JSON.stringify(data1, null, 2));
    } else {
      const errorText = await response1.text();
      console.log('Error:', errorText);
    }
    
    // Test 2: Check if reels endpoint exists at all
    console.log('\n2. Testing /api/reels (no username)');
    const response2 = await fetch(`${API_BASE}/api/reels`);
    console.log('Status:', response2.status);
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('Response structure:', Object.keys(data2));
    } else {
      const errorText = await response2.text();
      console.log('Error:', errorText);
    }
    
    // Test 3: Check available endpoints
    console.log('\n3. Testing available endpoints:');
    const endpoints = [
      '/api/users',
      '/api/posts', 
      '/api/stories',
      '/api/reels'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        console.log(`${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
    
    // Test 4: Check if we can get user posts instead
    console.log('\n4. Testing user posts endpoint:');
    const response4 = await fetch(`${API_BASE}/api/users/its_harshit_01/posts`);
    console.log('Status:', response4.status);
    if (response4.ok) {
      const data4 = await response4.json();
      console.log('Posts found:', data4.posts?.length || 0);
      if (data4.posts?.length > 0) {
        console.log('Post types:', data4.posts.map(p => p.type || 'post'));
      }
    } else {
      const errorText = await response4.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSpecificUserReels();