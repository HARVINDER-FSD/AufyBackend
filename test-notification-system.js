// Test script for notification system backend
// Tests the notification API endpoints

const axios = require('axios');

const API_BASE = 'https://aufybackend.onrender.com';
const TEST_EMAIL = 'hs8339952@gmail.com';
const TEST_PASSWORD = 'abc123';

async function testNotificationSystem() {
  console.log('🔔 Testing notification system backend...\n');

  try {
    // Step 1: Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (!loginResponse.data.token) {
      throw new Error('No token received from login');
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Step 2: Test notifications endpoint
    console.log('\n📬 Testing notifications endpoint...');
    try {
      const notificationsResponse = await axios.get(`${API_BASE}/api/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Notifications endpoint working');
      console.log(`📊 Found ${notificationsResponse.data.notifications?.length || 0} notifications`);
      console.log(`🔢 Unread count: ${notificationsResponse.data.unreadCount || 0}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Notifications endpoint not found - needs to be implemented');
      } else {
        console.log('❌ Notifications endpoint error:', error.response?.status, error.response?.data?.message);
      }
    }

    // Step 3: Test unread count endpoint
    console.log('\n🔢 Testing unread count endpoint...');
    try {
      const unreadResponse = await axios.get(`${API_BASE}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Unread count endpoint working');
      console.log(`📊 Unread count: ${unreadResponse.data.unreadCount || 0}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Unread count endpoint not found - needs to be implemented');
      } else {
        console.log('❌ Unread count endpoint error:', error.response?.status, error.response?.data?.message);
      }
    }

    // Step 4: Test push token endpoint
    console.log('\n📱 Testing push token endpoint...');
    try {
      const pushTokenResponse = await axios.post(`${API_BASE}/api/users/push-token`, {
        pushToken: 'ExponentPushToken[test-token-123]',
        platform: 'android',
        deviceId: 'test-device'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Push token endpoint working');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Push token endpoint not found - needs to be implemented');
      } else {
        console.log('❌ Push token endpoint error:', error.response?.status, error.response?.data?.message);
      }
    }

    console.log('\n🎯 Backend Test Summary:');
    console.log('========================');
    console.log('✅ Authentication: Working');
    console.log('📱 Mobile app: Ready for notifications');
    console.log('🔧 Backend: May need notification endpoints');
    
    console.log('\n📋 Next Steps:');
    console.log('1. If endpoints are missing, implement them in your backend');
    console.log('2. Test notifications in the mobile app');
    console.log('3. Check device notification permissions');
    console.log('4. Verify push tokens are being registered');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

// Run the test
testNotificationSystem();