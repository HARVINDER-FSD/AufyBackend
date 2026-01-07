import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import User from '../models/user';

const expo = new Expo();

interface SendNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: any;
  channelId?: string;
  badge?: number;
}

export async function sendExpoNotification(options: SendNotificationOptions) {
  try {
    const { userId, title, body, data, channelId, badge } = options;

    const user = await User.findById(userId);

    if (!user || !user.pushToken) {
      console.log(`🔕 No push token for user ${userId}`);
      return null;
    }

    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`❌ Invalid Expo push token for user ${userId}: ${user.pushToken}`);
      return null;
    }

    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
      badge: badge || 1,
      channelId: channelId || 'default',
      priority: 'high',
    };

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

    console.log(`✅ Push notification sent to ${userId}`);
    return tickets;
  } catch (error) {
    console.error('Error sending Expo notification:', error);
    return null;
  }
}

export function getChannelId(type: string): string {
  switch (type) {
    case 'message':
      return 'messages';
    case 'call':
    case 'video_call':
      return 'calls';
    case 'like':
    case 'comment':
      return 'likes';
    case 'follow':
    case 'follow_request':
    case 'follow_accept':
      return 'follows';
    default:
      return 'default';
  }
}
