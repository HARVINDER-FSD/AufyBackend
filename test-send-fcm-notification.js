// Test Sending FCM Push Notification
// This requires Firebase Admin SDK to be set up

async function testSendFCMNotification() {
  console.log('🧪 Testing FCM Push Notification Sending...\n');

  try {
    // Try to import Firebase messaging service
    const { sendNotificationToUser } = require('./src/services/firebase-messaging');
    
    console.log('✅ Firebase messaging service loaded\n');

    // Test sending notification
    console.log('📤 Sending test notification...');
    
    // Replace with actual user ID from your database
    const testUserId = '6756e0e0e0e0e0e0e0e0e0e0'; // Update this
    
    const result = await sendNotificationToUser(testUserId, {
      title: 'Test Notification',
      body: 'This is a test push notification from your backend!',
      type: 'test',
      data: {
        timestamp: Date.now().toString(),
        source: 'test-script'
      }
    });

    if (result) {
      console.log('✅ Notification sent successfully!');
      console.log('   Success count:', result.successCount);
      if (result.failedTokens && result.failedTokens.length > 0) {
        console.log('   Failed tokens:', result.failedTokens.length);
      }
    } else {
      console.log('⚠️  No FCM tokens found for user');
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ Firebase Admin SDK not installed');
      console.log('\n📋 To fix:');
      console.log('1. Install: npm install firebase-admin');
      console.log('2. Download firebase-service-account.json from Firebase Console');
      console.log('3. Place it in api-server/ folder');
      console.log('4. Update .env with Firebase credentials');
    } else {
      console.error('❌ Test failed:', error.message);
      console.error(error);
    }
  }
}

testSendFCMNotification();
