// Notifications API Routes
import express, { Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import authenticateToken from '../middleware/auth';

const authenticate = authenticateToken;

const router = express.Router();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media';

// GET /api/notifications - Get all notifications for current user
router.get('/', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    const query: any = { userId: new ObjectId(userId) };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    // Get notifications with actor details
    const notifications = await db.collection('notifications')
      .aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: Number(skip) },
        { $limit: Number(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'actorId',
            foreignField: '_id',
            as: 'actor'
          }
        },
        { $unwind: '$actor' },
        {
          $lookup: {
            from: 'posts',
            localField: 'postId',
            foreignField: '_id',
            as: 'post'
          }
        },
        {
          $project: {
            _id: 1,
            type: 1,
            content: 1,
            postId: 1,
            conversationId: 1,
            isRead: 1,
            createdAt: 1,
            'actor._id': 1,
            'actor.username': 1,
            'actor.full_name': 1,
            'actor.avatar': 1,
            'actor.avatar_url': 1,
            'actor.verified': 1,
            'actor.is_verified': 1,
            'post._id': { $arrayElemAt: ['$post._id', 0] },
            'post.image_url': { $arrayElemAt: ['$post.image_url', 0] },
            'post.media': { $arrayElemAt: ['$post.media', 0] }
          }
        }
      ])
      .toArray();

    // Get unread count
    const unreadCount = await db.collection('notifications').countDocuments({
      userId: new ObjectId(userId),
      isRead: false
    });

    await client.close();

    // Format notifications
    const formattedNotifications = notifications.map(notif => ({
      id: notif._id.toString(),
      type: notif.type,
      user: {
        id: notif.actor._id.toString(),
        username: notif.actor.username,
        avatar: notif.actor.avatar_url || notif.actor.avatar || '/placeholder-user.jpg',
        verified: notif.actor.is_verified || notif.actor.verified || false
      },
      content: notif.content,
      post: notif.post?._id ? {
        id: notif.post._id.toString(),
        image: notif.post.image_url || notif.post.media?.[0]?.url
      } : undefined,
      conversationId: notif.conversationId,
      timestamp: getTimeAgo(notif.createdAt),
      isRead: notif.isRead
    }));

    res.json({
      notifications: formattedNotifications,
      unreadCount,
      hasMore: notifications.length === Number(limit)
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    const unreadCount = await db.collection('notifications').countDocuments({
      userId: new ObjectId(userId),
      isRead: false
    });

    await client.close();

    res.json({ unreadCount });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: error.message || 'Failed to get unread count' });
  }
});

// PUT /api/notifications/:notificationId/read - Mark notification as read
router.put('/:notificationId/read', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    const result = await db.collection('notifications').updateOne(
      {
        _id: new ObjectId(notificationId),
        userId: new ObjectId(userId)
      },
      {
        $set: {
          isRead: true,
          updatedAt: new Date()
        }
      }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: error.message || 'Failed to mark notification as read' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    await db.collection('notifications').updateMany(
      {
        userId: new ObjectId(userId),
        isRead: false
      },
      {
        $set: {
          isRead: true,
          updatedAt: new Date()
        }
      }
    );

    await client.close();

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: error.message || 'Failed to mark all notifications as read' });
  }
});

// DELETE /api/notifications/:notificationId - Delete notification
router.delete('/:notificationId', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    const result = await db.collection('notifications').deleteOne({
      _id: new ObjectId(notificationId),
      userId: new ObjectId(userId)
    });

    await client.close();

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete notification' });
  }
});

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default router;
