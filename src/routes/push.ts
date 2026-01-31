import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../lib/database';
import User from '../models/user';
import { authenticateToken } from '../middleware/auth';
import { Expo } from 'expo-server-sdk';
import { sendPushNotification, sendBulkPushNotifications } from '../lib/push-service';

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

    const tickets = await sendPushNotification(userId, notification);
    
    if (tickets === null) {
       // This could mean user not found or no token, but we'll return generic success/failure
       // based on service contract. For now, assuming if service returns null it logged why.
       // Let's check user existence to be consistent with previous behavior if needed, 
       // but service handles it.
       return res.status(404).json({ success: false, message: "Failed to send (User not found or no token)" });
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

    const tickets = await sendBulkPushNotifications(userIds, notification);

    if (tickets === null) {
        return res.status(404).json({ success: false, message: "No valid users/tokens found" });
    }

    res.json({
      success: true,
      message: `Push notifications processing`,
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

export default router;
