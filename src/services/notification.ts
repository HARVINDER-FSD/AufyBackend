import { getWebSocketService } from "../lib/websocket"
import type { Notification, PaginatedResponse } from "../lib/types"
import { pagination, errors } from "../lib/utils"
import NotificationModel from "../models/notification"
import UserModel from "../models/user"

export class NotificationService {
  // Get unread count
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await NotificationModel.countDocuments({
        user_id: userId,
        is_read: false
      });
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Create notification
  static async createNotification(
    userId: string,
    type: string,
    title: string,
    content?: string,
    data?: any,
  ): Promise<Notification> {
    const notification = await NotificationModel.create({
        user_id: userId,
        type,
        title,
        content,
        data,
        is_read: false
    });

    const notifObj: Notification = {
      id: notification._id.toString(),
      user_id: notification.user_id.toString(),
      type: notification.type as any,
      title: notification.title,
      content: notification.content,
      data: notification.data,
      is_read: notification.is_read,
      created_at: notification.created_at,
      updated_at: notification.updated_at
    };

    // Send real-time notification
    const wsService = getWebSocketService()
    wsService.sendNotificationToUser(userId, notifObj)

    return notifObj
  }

  // Get user notifications
  static async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<PaginatedResponse<Notification>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const skip = (validPage - 1) * validLimit;

    const query: any = { user_id: userId };
    if (unreadOnly) {
        query.is_read = false;
    }

    const total = await NotificationModel.countDocuments(query);
    
    const docs = await NotificationModel.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(validLimit);

    const notifications = docs.map((doc) => ({
      id: doc._id.toString(),
      user_id: doc.user_id.toString(),
      type: doc.type as any,
      title: doc.title,
      content: doc.content,
      data: doc.data,
      is_read: doc.is_read,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    }))

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: notifications,
      pagination: paginationMeta,
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    const result = await NotificationModel.updateOne(
        { _id: notificationId, user_id: userId },
        { is_read: true }
    );

    if (result.matchedCount === 0) {
      throw errors.notFound("Notification not found")
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
        { user_id: userId, is_read: false },
        { is_read: true }
    );
  }

  // Delete notification
  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const result = await NotificationModel.deleteOne({ _id: notificationId, user_id: userId });

    if (result.deletedCount === 0) {
      throw errors.notFound("Notification not found")
    }
  }

  // Notification helpers for different events
  static async notifyLike(postId: string, likedByUserId: string, postOwnerId: string): Promise<void> {
    if (likedByUserId === postOwnerId) return // Don't notify self

    const user = await UserModel.findById(likedByUserId).select('username full_name');
    if (!user) return

    const displayName = user.full_name || user.username

    await this.createNotification(postOwnerId, "like", "New Like", `${displayName} liked your post`, {
      postId,
      likedByUserId,
      likedByUsername: user.username,
      likedByName: displayName,
    })
  }

  static async notifyComment(postId: string, commentedByUserId: string, postOwnerId: string): Promise<void> {
    if (commentedByUserId === postOwnerId) return // Don't notify self

    const user = await UserModel.findById(commentedByUserId).select('username full_name');
    if (!user) return

    const displayName = user.full_name || user.username

    await this.createNotification(postOwnerId, "comment", "New Comment", `${displayName} commented on your post`, {
      postId,
      commentedByUserId,
      commentedByUsername: user.username,
      commentedByName: displayName,
    })
  }

  static async notifyFollow(followerId: string, followingId: string): Promise<void> {
    const user = await UserModel.findById(followerId).select('username full_name');
    if (!user) return

    const displayName = user.full_name || user.username

    await this.createNotification(followingId, "follow", "New Follower", `${displayName} started following you`, {
      followerId,
      followerUsername: user.username,
      followerName: displayName,
    })
  }

  static async notifyFollowRequest(followerId: string, followingId: string): Promise<void> {
    const user = await UserModel.findById(followerId).select('username full_name');
    if (!user) return

    const displayName = user.full_name || user.username

    await this.createNotification(
      followingId,
      "follow_request",
      "Follow Request",
      `${displayName} wants to follow you`,
      {
        followerId,
        followerUsername: user.username,
        followerName: displayName,
      },
    )
  }

  static async notifyMessage(conversationId: string, senderId: string, recipientId: string): Promise<void> {
    if (senderId === recipientId) return // Don't notify self

    const user = await UserModel.findById(senderId).select('username full_name');
    if (!user) return

    const displayName = user.full_name || user.username

    await this.createNotification(recipientId, "message", "New Message", `${displayName} sent you a message`, {
      conversationId,
      senderId,
      senderUsername: user.username,
      senderName: displayName,
    })
  }

  // Clean up old notifications (cleanup job)
  static async cleanupOldNotifications(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await NotificationModel.deleteMany({
        created_at: { $lt: cutoffDate }
    });

    return result.deletedCount || 0
  }
}
