// Notifications API Routes
import express, { Response } from 'express';
import { ObjectId } from 'mongodb';
import { maskAnonymousUser } from '../lib/anonymous-utils';
import authenticateToken from '../middleware/auth';
import { getDatabase } from '../lib/database';

const authenticate = authenticateToken;

const router = express.Router();

// GET /api/notifications - Get all notifications for current user
router.get('/', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;

    const rawLimit = Number(limit) || 50;
    const safeLimit = Math.min(Math.max(rawLimit, 1), 100);
    const rawSkip = Number(skip) || 0;
    const safeSkip = Math.max(rawSkip, 0);

    const db = await getDatabase();

    const query: any = { user_id: new ObjectId(userId) };
    if (unreadOnly === 'true') {
      query.is_read = false;
    }

    // 🛡️ Exclude notifications from blocked users
    const blocks = await db.collection('blocked_users').find({
      $or: [
        { userId: new ObjectId(userId) },
        { blockedUserId: new ObjectId(userId) }
      ]
    }).toArray();
    const excludedIds = blocks.map(b =>
      b.userId.toString() === userId ? b.blockedUserId : b.userId
    );
    if (excludedIds.length > 0) {
      query.actor_id = { $nin: excludedIds };
    }

    // 🛡️ ANONYMOUS MODE CHECK: Filter out reel-related notifications
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (user?.isAnonymousMode) {
      // Exclude all reel-related notifications
      query.$and = query.$and || [];
      query.$and.push({
        $and: [
          { 'data.contentType': { $ne: 'reel' } },
          { 'data.type': { $nin: ['reel_like', 'reel_comment', 'reel_share', 'reel_mention'] } },
          { type: { $nin: ['reel_like', 'reel_comment', 'reel_share', 'reel_mention'] } },
          { content: { $not: /reel/i } }
        ]
      });
      console.log('[Notifications] Anonymous mode: Filtering out reel notifications')
    }

    // Get notifications with actor details
    const notifications = await db.collection('notifications')
      .aggregate([
        { $match: query },
        { $sort: { created_at: -1 } },
        { $skip: safeSkip },
        { $limit: safeLimit },
        {
          $lookup: {
            from: 'users',
            localField: 'actor_id',
            foreignField: '_id',
            as: 'actor'
          }
        },
        {
          $unwind: {
            path: '$actor',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          // Convert string postId from data to ObjectId for lookup
          $addFields: {
            lookupPostId: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$data.postId", null] },
                    { $ne: ["$data.postId", undefined] },
                    { $ne: ["$data.postId", ""] }
                  ]
                },
                then: { $toObjectId: "$data.postId" },
                else: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'posts',
            localField: 'lookupPostId',
            foreignField: '_id',
            as: 'post'
          }
        },
        {
          $project: {
            _id: 1,
            type: 1,
            content: 1,
            data: 1,
            is_read: 1,
            is_anonymous: 1, // Include anonymous flag
            created_at: 1,
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
      user_id: new ObjectId(userId),
      is_read: false
    });

    // Format notifications
    const formattedNotifications = notifications.map(notif => {
      const actor = notif.actor || {};
      const masked = maskAnonymousUser({
        _id: actor._id,
        id: actor._id?.toString(),
        username: actor.username || 'System',
        full_name: actor.full_name || 'AnuFy',
        avatar: actor.avatar_url || actor.avatar || '/placeholder-user.jpg',
        avatar_url: actor.avatar_url || actor.avatar || '/placeholder-user.jpg',
        is_verified: actor.is_verified || actor.verified || false,
        badge_type: null,
        is_anonymous: notif.is_anonymous
      });

      return {
        id: notif._id.toString(),
        type: notif.type,
        user: {
          id: masked.id,
          username: masked.username,
          avatar: masked.avatar_url,
          verified: masked.is_verified,
          is_anonymous: masked.is_anonymous ?? false
        },
        content: notif.content,
        post: notif.post?._id ? {
          id: notif.post._id.toString(),
          image: notif.post.image_url || notif.post.media?.[0]?.url
        } : undefined,
        conversationId: notif.data?.conversationId,
        timestamp: getTimeAgo(notif.created_at),
        isRead: notif.is_read
      };
    });

    res.json({
      notifications: formattedNotifications,
      unreadCount,
      hasMore: notifications.length === safeLimit
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

    const db = await getDatabase();

    // Get unread count
    const unreadCount = await db.collection('notifications').countDocuments({
      user_id: new ObjectId(userId),
      is_read: false
    });

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

    const db = await getDatabase();

    const result = await db.collection('notifications').updateOne(
      {
        _id: new ObjectId(notificationId),
        user_id: new ObjectId(userId)
      },
      {
        $set: {
          is_read: true,
          updated_at: new Date()
        }
      }
    );

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

    const db = await getDatabase();

    await db.collection('notifications').updateMany(
      {
        user_id: new ObjectId(userId),
        is_read: false
      },
      {
        $set: {
          is_read: true,
          updated_at: new Date()
        }
      }
    );

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

    const db = await getDatabase();

    const result = await db.collection('notifications').deleteOne({
      _id: new ObjectId(notificationId),
      user_id: new ObjectId(userId)
    });

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
