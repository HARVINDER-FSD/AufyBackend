// Notification Helper Functions
import { MongoClient, ObjectId } from 'mongodb';
import { sendPushNotification } from '../services/firebase-messaging';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media';

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'message' 
  | 'mention' 
  | 'share'
  | 'follow_request'
  | 'follow_accept'
  | 'secret_crush_match'
  | 'secret_crush_ended'
  | 'secret_crush_removed';

interface CreateNotificationOptions {
  userId: string | ObjectId; // Recipient
  actorId: string | ObjectId; // Person performing action
  type: NotificationType;
  postId?: string | ObjectId;
  commentId?: string | ObjectId;
  conversationId?: string;
  content?: string;
}

// Create a notification with Instagram-style deduplication
export async function createNotification(options: CreateNotificationOptions): Promise<string | null> {
  try {
    const { userId, actorId, type, postId, commentId, conversationId, content } = options;

    // Don't notify yourself
    if (userId.toString() === actorId.toString()) {
      return null;
    }

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    // Instagram-style deduplication: Check for existing notification from same actor
    // For the same type and target (post/comment/conversation)
    const query: any = {
      userId: new ObjectId(userId),
      actorId: new ObjectId(actorId),
      type
    };

    // Add context-specific filters
    if (postId) query.postId = new ObjectId(postId);
    if (commentId) query.commentId = new ObjectId(commentId);
    if (conversationId) query.conversationId = conversationId;

    // Check if notification already exists (within last 24 hours to avoid old duplicates)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingNotification = await db.collection('notifications').findOne({
      ...query,
      createdAt: { $gte: oneDayAgo }
    });

    if (existingNotification) {
      // Update existing notification instead of creating duplicate
      await db.collection('notifications').updateOne(
        { _id: existingNotification._id },
        {
          $set: {
            isRead: false, // Mark as unread again
            updatedAt: new Date(),
            content: content || existingNotification.content // Update content if provided
          }
        }
      );
      await client.close();
      console.log(`♻️ Updated existing notification: ${type} from ${actorId} to ${userId}`);
      return existingNotification._id.toString();
    }

    // Create new notification if no duplicate found
    const notification = {
      userId: new ObjectId(userId),
      actorId: new ObjectId(actorId),
      type,
      postId: postId ? new ObjectId(postId) : undefined,
      commentId: commentId ? new ObjectId(commentId) : undefined,
      conversationId,
      content,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('notifications').insertOne(notification);
    
    // Get actor details for push notification
    const actor = await db.collection('users').findOne({ _id: new ObjectId(actorId) });
    
    await client.close();

    console.log(`📬 Notification created: ${type} for user ${userId}`);
    
    // Send Push Notification (works even when app is closed!)
    if (actor) {
      await sendPushNotificationToUser(userId.toString(), type, actor, {
        notificationId: result.insertedId.toString(),
        postId: postId?.toString(),
        commentId: commentId?.toString(),
        conversationId,
        content
      });
    }
    
    return result.insertedId.toString();
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// Create like notification
export async function notifyLike(
  postOwnerId: string | ObjectId,
  actorId: string | ObjectId,
  postId: string | ObjectId
): Promise<string | null> {
  return createNotification({
    userId: postOwnerId,
    actorId,
    type: 'like',
    postId
  });
}

// Create comment notification
export async function notifyComment(
  postOwnerId: string | ObjectId,
  actorId: string | ObjectId,
  postId: string | ObjectId,
  commentId: string | ObjectId,
  commentText: string
): Promise<string | null> {
  return createNotification({
    userId: postOwnerId,
    actorId,
    type: 'comment',
    postId,
    commentId,
    content: commentText.substring(0, 100) // Limit preview length
  });
}

// Create follow notification
export async function notifyFollow(
  userId: string | ObjectId,
  actorId: string | ObjectId
): Promise<string | null> {
  return createNotification({
    userId,
    actorId,
    type: 'follow'
  });
}

// Create message notification
export async function notifyMessage(
  userId: string | ObjectId,
  actorId: string | ObjectId,
  conversationId: string,
  messagePreview: string
): Promise<string | null> {
  return createNotification({
    userId,
    actorId,
    type: 'message',
    conversationId,
    content: messagePreview.substring(0, 100)
  });
}

// Create mention notification
export async function notifyMention(
  userId: string | ObjectId,
  actorId: string | ObjectId,
  postId: string | ObjectId,
  content: string
): Promise<string | null> {
  return createNotification({
    userId,
    actorId,
    type: 'mention',
    postId,
    content: content.substring(0, 100)
  });
}

// Create share notification
export async function notifyShare(
  postOwnerId: string | ObjectId,
  actorId: string | ObjectId,
  postId: string | ObjectId
): Promise<string | null> {
  return createNotification({
    userId: postOwnerId,
    actorId,
    type: 'share',
    postId
  });
}

// Delete notifications for a specific post
export async function deletePostNotifications(postId: string | ObjectId): Promise<void> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    await db.collection('notifications').deleteMany({
      postId: new ObjectId(postId)
    });

    await client.close();
    console.log(`🗑️ Deleted notifications for post ${postId}`);
  } catch (error) {
    console.error('Error deleting post notifications:', error);
  }
}

// Delete notifications for a specific comment
export async function deleteCommentNotifications(commentId: string | ObjectId): Promise<void> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    await db.collection('notifications').deleteMany({
      commentId: new ObjectId(commentId)
    });

    await client.close();
    console.log(`🗑️ Deleted notifications for comment ${commentId}`);
  } catch (error) {
    console.error('Error deleting comment notifications:', error);
  }
}

// Clean up duplicate notifications (run this as maintenance)
export async function cleanupDuplicateNotifications(): Promise<number> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    // Find duplicate notifications (same userId, actorId, type, and target within 24 hours)
    const duplicates = await db.collection('notifications').aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            actorId: '$actorId',
            type: '$type',
            postId: '$postId',
            commentId: '$commentId',
            conversationId: '$conversationId'
          },
          notifications: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    let deletedCount = 0;

    // For each group of duplicates, keep the most recent one and delete others
    for (const group of duplicates) {
      const notifications = group.notifications.sort((a: any, b: any) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      // Keep the first (most recent), delete the rest
      const toDelete = notifications.slice(1).map((n: any) => n._id);
      
      if (toDelete.length > 0) {
        const result = await db.collection('notifications').deleteMany({
          _id: { $in: toDelete }
        });
        deletedCount += result.deletedCount || 0;
      }
    }

    await client.close();
    console.log(`🧹 Cleaned up ${deletedCount} duplicate notifications`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up duplicate notifications:', error);
    return 0;
  }
}

// Delete follow notification when unfollowed
export async function deleteFollowNotification(
  userId: string | ObjectId,
  actorId: string | ObjectId
): Promise<void> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    await db.collection('notifications').deleteMany({
      userId: new ObjectId(userId),
      actorId: new ObjectId(actorId),
      type: 'follow'
    });

    await client.close();
    console.log(`🗑️ Deleted follow notification from ${actorId} to ${userId}`);
  } catch (error) {
    console.error('Error deleting follow notification:', error);
  }
}

// Delete like notification when unliked
export async function deleteLikeNotification(
  postOwnerId: string | ObjectId,
  actorId: string | ObjectId,
  postId: string | ObjectId
): Promise<void> {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    await db.collection('notifications').deleteMany({
      userId: new ObjectId(postOwnerId),
      actorId: new ObjectId(actorId),
      type: 'like',
      postId: new ObjectId(postId)
    });

    await client.close();
    console.log(`🗑️ Deleted like notification for post ${postId}`);
  } catch (error) {
    console.error('Error deleting like notification:', error);
  }
}


// Send Push Notification to user with avatar and name
async function sendPushNotificationToUser(
  userId: string,
  type: NotificationType,
  actor: any,
  data: {
    notificationId: string;
    postId?: string;
    commentId?: string;
    conversationId?: string;
    content?: string;
  }
): Promise<void> {
  try {
    const actorName = actor.username || actor.name || 'Someone';
    const actorAvatar = actor.avatar_url || actor.profileImage || '/placeholder-user.jpg';
    
    let title = '';
    let body = '';
    
    // Create notification text based on type
    switch (type) {
      case 'like':
        title = `${actorName} liked your post`;
        body = 'Tap to view';
        break;
        
      case 'comment':
        title = `${actorName} commented`;
        body = data.content || 'Tap to view comment';
        break;
        
      case 'follow':
        title = `${actorName} started following you`;
        body = 'Tap to view profile';
        break;
        
      case 'message':
        title = actorName;
        body = data.content || 'Sent you a message';
        break;
        
      case 'mention':
        title = `${actorName} mentioned you`;
        body = data.content || 'Tap to view';
        break;
        
      case 'share':
        title = `${actorName} shared your post`;
        body = 'Tap to view';
        break;
        
      case 'follow_request':
        title = `${actorName} wants to follow you`;
        body = 'Tap to respond';
        break;
        
      case 'follow_accept':
        title = `${actorName} accepted your follow request`;
        body = 'Tap to view profile';
        break;
        
      case 'secret_crush_match':
        title = '💕 You have a Secret Crush match!';
        body = 'Tap to see who';
        break;
        
      case 'secret_crush_ended':
        title = 'Secret Crush ended';
        body = `${actorName} removed you from their list`;
        break;
        
      default:
        title = 'New notification';
        body = 'You have a new notification';
    }
    
    // Get user's FCM token or Expo push token
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    await client.close();
    
    if (!user) {
      console.log('⚠️ User not found for notification:', userId);
      return;
    }

    // Try sending via Expo Push Token first (since mobile app registers this)
    if (user.pushToken) {
      console.log(`📱 Sending Expo push notification to ${userId}`);
      await sendExpoPushNotification(user.pushToken, {
        title,
        body,
        data: {
          type,
          notificationId: data.notificationId,
          userId: actor._id?.toString() || '',
          username: actorName,
          avatar: actorAvatar,
          postId: data.postId || '',
          commentId: data.commentId || '',
          conversationId: data.conversationId || '',
        }
      });
      // We can continue to try FCM if we want, or return here.
      // Usually one is enough. If Expo works, we're good.
      // But for backward compatibility, we can leave the FCM check below if we want.
      // However, duplicate notifications are annoying. Let's prefer Expo if available.
      return; 
    }
    
    if (!user.fcmToken) {
      console.log('⚠️ No push token (FCM or Expo) for user:', userId);
      return;
    }
    
    // Fallback: Send Firebase push notification (legacy/Android native)
    await sendPushNotification(user.fcmToken, {
      title,
      body,
      data: {
        type,
        notificationId: data.notificationId,
        userId: actor._id?.toString() || '',
        username: actorName,
        avatar: actorAvatar,
        postId: data.postId || '',
        commentId: data.commentId || '',
        conversationId: data.conversationId || '',
      }
    });
    
    console.log(`🔔 Push notification sent: ${type} to ${userId}`);
  } catch (error) {
    console.error('Error sending push notification:', error);
    // Don't throw - notification creation should succeed even if push fails
  }
}
