import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export async function sendExpoPushNotification(
  pushToken: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    badge?: number;
    channelId?: string;
  }
) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return null;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: notification.sound || 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    badge: notification.badge || 1,
    channelId: notification.channelId || 'default',
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
    
    // Log success
    console.log(`✅ Expo push notification sent to ${pushToken}`);
    
    return tickets;
  } catch (error) {
    console.error('Error sending Expo push notification:', error);
    return null;
  }
}
