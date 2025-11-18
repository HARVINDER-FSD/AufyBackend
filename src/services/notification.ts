import { query } from "../lib/database"
import { getWebSocketService } from "../lib/websocket"
import type { Notification, PaginatedResponse } from "../lib/types"
import { pagination, errors } from "../lib/utils"
import NotificationModel from "../models/notification"

export class NotificationService {
  // Get unread count (MongoDB version)
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await NotificationModel.countDocuments({
        recipient_id: userId,
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
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, content, data) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, user_id, type, title, content, data, is_read, created_at`,
      [userId, type, title, content, data ? JSON.stringify(data) : null],
    )

    const notification: Notification = {
      ...result.rows[0],
      data: result.rows[0].data ? JSON.parse(result.rows[0].data) : null,
    }

    // Send real-time notification
    const wsService = getWebSocketService()
    wsService.sendNotificationToUser(userId, notification)

    return notification
  }

  // Get user notifications
  static async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<PaginatedResponse<Notification>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const whereClause = unreadOnly ? "WHERE user_id = $1 AND is_read = false" : "WHERE user_id = $1"

    const result = await query(
      `SELECT id, user_id, type, title, content, data, is_read, created_at,
              COUNT(*) OVER() as total_count
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, validLimit, offset],
    )

    const notifications = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      content: row.content,
      data: row.data ? JSON.parse(row.data) : null,
      is_read: row.is_read,
      created_at: row.created_at,
    }))

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: notifications,
      pagination: paginationMeta,
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    const result = await query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [
      notificationId,
      userId,
    ])

    if (result.rowCount === 0) {
      throw errors.notFound("Notification not found")
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string): Promise<void> {
    await query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false", [userId])
  }

  // Delete notification
  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const result = await query("DELETE FROM notifications WHERE id = $1 AND user_id = $2", [notificationId, userId])

    if (result.rowCount === 0) {
      throw errors.notFound("Notification not found")
    }
  }

  // Get unread count
  static async getUnreadCount(userId: string): Promise<number> {
    const result = await query("SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false", [
      userId,
    ])

    return Number.parseInt(result.rows[0].count)
  }

  // Notification helpers for different events
  static async notifyLike(postId: string, likedByUserId: string, postOwnerId: string): Promise<void> {
    if (likedByUserId === postOwnerId) return // Don't notify self

    const userResult = await query("SELECT username, full_name FROM users WHERE id = $1", [likedByUserId])
    if (userResult.rows.length === 0) return

    const user = userResult.rows[0]
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

    const userResult = await query("SELECT username, full_name FROM users WHERE id = $1", [commentedByUserId])
    if (userResult.rows.length === 0) return

    const user = userResult.rows[0]
    const displayName = user.full_name || user.username

    await this.createNotification(postOwnerId, "comment", "New Comment", `${displayName} commented on your post`, {
      postId,
      commentedByUserId,
      commentedByUsername: user.username,
      commentedByName: displayName,
    })
  }

  static async notifyFollow(followerId: string, followingId: string): Promise<void> {
    const userResult = await query("SELECT username, full_name FROM users WHERE id = $1", [followerId])
    if (userResult.rows.length === 0) return

    const user = userResult.rows[0]
    const displayName = user.full_name || user.username

    await this.createNotification(followingId, "follow", "New Follower", `${displayName} started following you`, {
      followerId,
      followerUsername: user.username,
      followerName: displayName,
    })
  }

  static async notifyFollowRequest(followerId: string, followingId: string): Promise<void> {
    const userResult = await query("SELECT username, full_name FROM users WHERE id = $1", [followerId])
    if (userResult.rows.length === 0) return

    const user = userResult.rows[0]
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

    const userResult = await query("SELECT username, full_name FROM users WHERE id = $1", [senderId])
    if (userResult.rows.length === 0) return

    const user = userResult.rows[0]
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
    const result = await query("DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '$1 days'", [daysOld])

    return result.rowCount || 0
  }
}
