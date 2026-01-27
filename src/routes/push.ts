import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../lib/database';
import User from '../models/user';
import { authenticateToken } from '../middleware/auth';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const router = Router();
const expo = new Expo();

interface AuthRequest extends Request {
  user?: any;
  userId?: string;
}

// Save push token
router.post('/token', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase();

    const { pushToken, platform } = req.body;
    const userId = req.userId!;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required',
      });
    }

    // Validate Expo push token
    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Expo push token',
      });
    }

    // Update user with push token
    await User.findByIdAndUpdate(userId, {
      pushToken,
      pushTokenPlatform: platform,
      pushTokenUpdatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Push token saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving push token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save push token',
    });
  }
});

// Send push notification
router.post('/send', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase();

    const { userId, notification } = req.body;

    if (!userId || !notification) {
      return res.status(400).json({
        success: false,
        error: 'User ID and notification data are required',
      });
    }

    // Get user's push token
    const user = await User.findById(userId);

    if (!user || !user.pushToken) {
      return res.status(404).json({
        success: false,
        error: 'User not found or no push token registered',
      });
    }

    // Validate push token
    if (!Expo.isExpoPushToken(user.pushToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid push token',
      });
    }

    // Create push message
    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: 1,
      channelId: getChannelId(notification.type),
    };

    // Send push notification
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

    res.json({
      success: true,
      message: 'Push notification sent',
      tickets,
    });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send push notification',
    });
  }
});

// Send bulk push notifications
router.post('/send-bulk', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase();

    const { userIds, notification } = req.body;

    if (!userIds || !Array.isArray(userIds) || !notification) {
      return res.status(400).json({
        success: false,
        error: 'User IDs array and notification data are required',
      });
    }

    // Get users' push tokens
    const users = await User.find({
      _id: { $in: userIds },
      pushToken: { $exists: true, $ne: null },
    });

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No users with push tokens found',
      });
    }

    // Create push messages
    const messages: ExpoPushMessage[] = users
      .filter(user => Expo.isExpoPushToken(user.pushToken))
      .map(user => ({
        to: user.pushToken as string,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        badge: 1,
        channelId: getChannelId(notification.type),
      }));

    // Send push notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    res.json({
      success: true,
      message: `Push notifications sent to ${messages.length} users`,
      tickets,
    });
  } catch (error: any) {
    console.error('Error sending bulk push notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send push notifications',
    });
  }
});

// Helper function to get Android channel ID based on notification type
function getChannelId(type: string): string {
  switch (type) {
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

export default router;
