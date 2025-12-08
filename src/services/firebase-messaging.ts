import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
let isInitialized = false;

export function initializeFirebase() {
  if (isInitialized) return;
  
  try {
    // Check if service account file exists
    const serviceAccount = require('../../firebase-service-account.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    isInitialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.warn('⚠️ Firebase service account not found. Push notifications will not work when app is closed.');
    console.warn('To enable: Download firebase-service-account.json from Firebase Console');
  }
}

export async function sendPushNotification(
  fcmToken: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  if (!isInitialized) {
    console.warn('Firebase not initialized, skipping push notification');
    return null;
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'default',
          priority: 'high' as const,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Push notification sent:', response);
    return response;
  } catch (error: any) {
    console.error('❌ Failed to send push notification:', error.message);
    
    // Return error code for token cleanup
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { error: 'invalid_token' };
    }
    
    throw error;
  }
}

export async function sendMulticastNotification(
  fcmTokens: string[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  if (!isInitialized) {
    console.warn('Firebase not initialized, skipping multicast notification');
    return null;
  }

  try {
    const message = {
      tokens: fcmTokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Sent ${response.successCount}/${fcmTokens.length} notifications`);
    
    // Return failed tokens for cleanup
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push(fcmTokens[idx]);
      }
    });
    
    return { successCount: response.successCount, failedTokens };
  } catch (error) {
    console.error('❌ Failed to send multicast notification:', error);
    throw error;
  }
}

// Helper to send notification to user by ID
export async function sendNotificationToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    type: string;
    data?: Record<string, string>;
  }
) {
  try {
    // Import User model dynamically to avoid circular dependencies
    const User = require('../models/user').default;
    
    const user = await User.findById(userId);
    
    if (!user?.fcmTokens || user.fcmTokens.length === 0) {
      console.log('No FCM tokens for user:', userId);
      return;
    }
    
    // Send to all user's devices
    const result = await sendMulticastNotification(user.fcmTokens, {
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type,
        ...notification.data,
      }
    });
    
    // Clean up failed tokens
    if (result?.failedTokens && result.failedTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { $in: result.failedTokens } }
      });
      console.log(`Removed ${result.failedTokens.length} invalid tokens`);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending notification to user:', error);
  }
}
