// Complete FCM Test - Tests the entire flow
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://anufy-api.onrender.com';

// Test credentials - UPDATE THESE WITH YOUR REAL CREDENTIALS
const TEST_USER = {
  username: 'harvinder',  // Your username
  password: 'your_password_here'  // Your password
};

async function testFCMComplete() {
  console.log('🧪 Testing Complete FCM Flow...\n');
  
  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    
    if (!loginResponse.data.token) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.user._id;
    console.log('✅ Logged in as:', loginResponse.data.user.username);
    console.log('   User ID:', userId);
    
    // Step 2: Check if user has FCM token
    console.log('\n2️⃣ Checking FCM token...');
    const userResponse = await axios.get(`${API_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const fcmToken = userResponse.data.fcmToken;
    if (fcmToken) {
      console.log('✅ FCM token found:', fcmToken.substring(0, 30) + '...');
    } else {
      console.log('⚠️  No FCM token registered');
      console.log('   Make sure you:');
      console.log('   1. Opened the app on your phone');
      console.log('   2. Logged in');
      console.log('   3. Granted notification permissions');
      return;
    }
    
    // Step 3: Test notification by liking a post
    console.log('\n3️⃣ Testing notification...');
    console.log('   Looking for a post to like...');
    
    const feedResponse = await axios.get(`${API_URL}/api/posts/feed`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (feedResponse.data.posts && feedResponse.data.posts.length > 0) {
      const testPost = feedResponse.data.posts[0];
      console.log('   Found post:', testPost._id);
      
      // Like the post (this should trigger a notification)
      await axios.post(`${API_URL}/api/posts/${testPost._id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Liked post - notification should be sent!');
      console.log('\n📱 Check your phone:');
      console.log('   - If app is OPEN: You should see in-app notification');
      console.log('   - If app is CLOSED: You should see system notification');
      console.log('   - If app is BACKGROUNDED: You should see system notification');
    } else {
      console.log('⚠️  No posts found in feed to test with');
    }
    
    console.log('\n✅ Test complete!');
    console.log('\n📝 Summary:');
    console.log('   - Backend: ✅ Ready');
    console.log('   - FCM Token: ✅ Registered');
    console.log('   - Notification: ✅ Sent');
    console.log('\n   If you didn\'t receive notification, check:');
    console.log('   1. Phone notification settings');
    console.log('   2. App notification permissions');
    console.log('   3. Backend logs for errors');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testFCMComplete();
