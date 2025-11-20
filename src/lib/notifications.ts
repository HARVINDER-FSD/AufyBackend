// Notification Helper Functions
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media';

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'message' 
  | 'mention' 
  | 'share'
  | 'follow_request'
  | 'follow_accept';

interface CreateNotificationOptions {
  userId: string | ObjectId; // Recipient
  actorId: string | ObjectId; // Person performing action
  type: NotificationType;
  postId?: string | ObjectId;
  commentId?: string | ObjectId;
  conversationId?: string;
  content?: string;
}

// Create a notification
export async function createNotification(options: CreateNotificationOptions): Promise<string | null> {
  try {
    const { userId, actorId, type, postId, commentId, conversationId, content } = options;

    // Don't notify yourself
    if (userId.toString() === actorId.toString()) {
      return null;
    }

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

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
    await client.close();

    console.log(`📬 Notification created: ${type} for user ${userId}`);
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
