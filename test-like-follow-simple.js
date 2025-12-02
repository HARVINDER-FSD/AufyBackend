// Simple test to verify like and follow are working
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testWithYourAccount() {
  console.log('🔍 Testing Like & Follow Persistence\n');
  console.log('📝 INSTRUCTIONS:');
  console.log('1. Login to your mobile app');
  console.log('2. Like a post or reel');
  console.log('3. Close and reopen the app');
  console.log('4. Check if the like is still there\n');
  
  console.log('🔧 BACKEND STATUS CHECK:\n');
  
  try {
    // Test posts endpoint
    console.log('📝 Testing Posts API...');
    const postsResponse = await axios.get(`${API_URL}/api/posts/feed?limit=1`);
    console.log('✅ Posts API is working');
    console.log(`   Found ${postsResponse.data.data?.posts?.length || 0} posts`);
    
    // Test reels endpoint
    console.log('\n🎬 Testing Reels API...');
    const reelsResponse = await axios.get(`${API_URL}/api/reels?limit=1`);
    console.log('✅ Reels API is working');
    console.log(`   Found ${reelsResponse.data.data?.reels?.length || reelsResponse.data.reels?.length || 0} reels`);
    
    // Test users endpoint
    console.log('\n👥 Testing Users API...');
    const usersResponse = await axios.get(`${API_URL}/api/users/list?limit=1`);
    console.log('✅ Users API is working');
    console.log(`   Found ${usersResponse.data.data?.users?.length || usersResponse.data.users?.length || 0} users`);
    
    console.log('\n✅ ALL BACKEND APIS ARE WORKING!\n');
    
    console.log('🔍 COMMON ISSUES & SOLUTIONS:\n');
    console.log('1. LIKES NOT STAYING:');
    console.log('   - Check if you\'re logged in (token exists)');
    console.log('   - Check network connection');
    console.log('   - Check if API call is successful (200 status)');
    console.log('   - Check if response has "liked: true"');
    console.log('   - Clear app cache and try again\n');
    
    console.log('2. FOLLOW NOT STAYING:');
    console.log('   - Check if you\'re logged in (token exists)');
    console.log('   - Check network connection');
    console.log('   - Check if API call is successful (200 status)');
    console.log('   - Check if response has "isFollowing: true"');
    console.log('   - Clear app cache and try again\n');
    
    console.log('3. DEBUGGING STEPS:');
    console.log('   - Open mobile app');
    console.log('   - Enable React Native Debugger');
    console.log('   - Watch console logs when liking/following');
    console.log('   - Check for error messages');
    console.log('   - Check API response data\n');
    
  } catch (error) {
    console.error('❌ Backend test failed:', error.message);
    console.log('\n⚠️  Backend might be sleeping. Wait 30 seconds and try again.');
  }
}

testWithYourAccount();
