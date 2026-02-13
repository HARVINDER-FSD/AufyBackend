import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import User from '../models/user';
import { getDatabase } from './database';
import { ObjectId } from 'mongodb';

const expo = new Expo();

export interface PushNotificationData {
  title: string;
  body: string;
  data?: any;
  type?: string;
  sound?: 'default' | null;
  channelId?: string;
  categoryId?: string; // For interactive notifications (Reply, Like)
}

export async function sendPushNotification(userId: string, notification: PushNotificationData) {
  try {
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user || !user.pushToken) {
      console.log(`User ${userId} has no push token. Skipping notification.`);
      return null;
    }

    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`User ${userId} has invalid push token: ${user.pushToken}`);
      return null;
    }

    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: 1,
      channelId: notification.channelId || getChannelId(notification.type || 'default'),
      priority: 'high', // Critical for calls
      categoryId: notification.categoryId, // Pass categoryId to Expo
    };

    // For VoIP/Calls, we might need specific payload config
    if (notification.type === 'call') {
      message.ttl = 30; // 30 seconds expiry for calls
      message.priority = 'high';
    }

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

    return tickets;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return null;
  }
}

export async function sendBulkPushNotifications(userIds: string[], notification: PushNotificationData) {
  try {
    const db = await getDatabase();
    const users = await db.collection('users').find({
      _id: { $in: userIds.map(id => new ObjectId(id)) },
      pushToken: { $exists: true, $ne: null }
    }).toArray();

    if (users.length === 0) {
      return null;
    }

    const messages: ExpoPushMessage[] = users
      .filter(user => Expo.isExpoPushToken(user.pushToken))
      .map(user => ({
        to: user.pushToken,
        sound: notification.sound || 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        badge: 1,
        channelId: notification.channelId || getChannelId(notification.type || 'default'),
        categoryId: notification.categoryId,
      }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending bulk push chunk:', error);
      }
    }

    return tickets;
  } catch (error) {
    console.error('Error sending bulk push notifications:', error);
    return null;
  }
}

export function getChannelId(type: string): string {
  switch (type) {
    case 'call':
      return 'calls'; // High priority channel
    case 'message':
      return 'messages';
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
