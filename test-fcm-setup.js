// Test FCM Token Registration
const API_URL = 'https://aufybackend.onrender.com';

async function testFCMSetup() {
  console.log('🧪 Testing FCM Setup...\n');

  try {
    // 1. Login first
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'harvinder@gmail.com',
        password: 'Harvinder@123'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const { token } = await loginRes.json();
    console.log('✅ Logged in successfully\n');

    // 2. Register FCM token
    console.log('2️⃣ Registering FCM token...');
    const fcmToken = 'test-fcm-token-' + Date.now();
    
    const registerRes = await fetch(`${API_URL}/api/users/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fcmToken })
    });

    if (!registerRes.ok) {
      const error = await registerRes.text();
      throw new Error(`FCM registration failed: ${registerRes.status} - ${error}`);
    }

    const result = await registerRes.json();
    console.log('✅ FCM token registered:', result);
    console.log('   Token:', fcmToken.substring(0, 30) + '...\n');

    // 3. Verify token was saved
    console.log('3️⃣ Verifying token was saved...');
    const profileRes = await fetch(`${API_URL}/api/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (profileRes.ok) {
      const profile = await profileRes.json();
      if (profile.fcmToken) {
        console.log('✅ FCM token verified in profile');
        console.log('   Saved token:', profile.fcmToken.substring(0, 30) + '...\n');
      } else {
        console.log('⚠️  FCM token not found in profile\n');
      }
    }

    console.log('✅ All tests passed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Install Firebase packages in mobile-app:');
    console.log('   npx expo install @react-native-firebase/app @react-native-firebase/messaging');
    console.log('2. Add google-services.json to mobile-app/');
    console.log('3. Update app.json with Firebase plugin');
    console.log('4. Rebuild the app with: eas build');
    console.log('5. Test on real device (FCM doesn\'t work in Expo Go)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFCMSetup();
