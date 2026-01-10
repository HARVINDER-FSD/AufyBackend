// Notification Service - Helper functions to create notifications
import Notification from '@/models/notification';

export interface CreateNotificationParams {
  recipientId: string;
  senderId: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'story_like' | 'story_reply' | 'reel_like' | 'reel_comment';
  contentId?: string;
  contentType?: 'post' | 'reel' | 'story' | 'comment';
  message?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    // Don't create notification if sender and recipient are the same
    if (params.senderId === params.recipientId) {
      return null;
    }

    // Check if similar notification already exists (prevent duplicates)
    const existingNotification = await Notification.findOne({
      recipient_id: params.recipientId,
      sender_id: params.senderId,
      type: params.type,
      content_id: params.contentId,
      created_at: { $gte: new Date(Date.now() - 60000) } // Within last minute
    });

    if (existingNotification) {
      return existingNotification;
    }

    // Create new notification
    const notification = await Notification.create({
      recipient_id: params.recipientId,
      sender_id: params.senderId,
      type: params.type,
      content_id: params.contentId,
      content_type: params.contentType,
      message: params.message,
      is_read: false
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// Helper functions for specific notification types
export async function notifyPostLike(postOwnerId: string, likerId: string, postId: string) {
  return createNotification({
    recipientId: postOwnerId,
    senderId: likerId,
    type: 'like',
    contentId: postId,
    contentType: 'post'
  });
}

export async function notifyPostComment(postOwnerId: string, commenterId: string, postId: string, commentText: string) {
  return createNotification({
    recipientId: postOwnerId,
    senderId: commenterId,
    type: 'comment',
    contentId: postId,
    contentType: 'post',
    message: commentText.substring(0, 100) // First 100 chars
  });
}

export async function notifyFollow(followedUserId: string, followerId: string) {
  return createNotification({
    recipientId: followedUserId,
    senderId: followerId,
    type: 'follow'
  });
}

export async function notifyMention(mentionedUserId: string, mentionerId: string, contentId: string, contentType: 'post' | 'story' | 'comment') {
  return createNotification({
    recipientId: mentionedUserId,
    senderId: mentionerId,
    type: 'mention',
    contentId,
    contentType
  });
}

export async function notifyCommentReply(commentOwnerId: string, replierId: string, commentId: string, replyText: string) {
  return createNotification({
    recipientId: commentOwnerId,
    senderId: replierId,
    type: 'reply',
    contentId: commentId,
    contentType: 'comment',
    message: replyText.substring(0, 100)
  });
}

export async function notifyStoryLike(storyOwnerId: string, likerId: string, storyId: string) {
  return createNotification({
    recipientId: storyOwnerId,
    senderId: likerId,
    type: 'story_like',
    contentId: storyId,
    contentType: 'story'
  });
}

export async function notifyStoryReply(storyOwnerId: string, replierId: string, storyId: string, replyText: string) {
  return createNotification({
    recipientId: storyOwnerId,
    senderId: replierId,
    type: 'story_reply',
    contentId: storyId,
    contentType: 'story',
    message: replyText.substring(0, 100)
  });
}

export async function notifyReelLike(reelOwnerId: string, likerId: string, reelId: string) {
  return createNotification({
    recipientId: reelOwnerId,
    senderId: likerId,
    type: 'reel_like',
    contentId: reelId,
    contentType: 'reel'
  });
}

export async function notifyReelComment(reelOwnerId: string, commenterId: string, reelId: string, commentText: string) {
  return createNotification({
    recipientId: reelOwnerId,
    senderId: commenterId,
    type: 'reel_comment',
    contentId: reelId,
    contentType: 'reel',
    message: commentText.substring(0, 100)
  });
}
