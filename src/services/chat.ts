import { query, cache, transaction } from "../lib/database"
import { getWebSocketService } from "../lib/websocket"
import type { Conversation, Message, SendMessageRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"

export class ChatService {
  // Create or get direct conversation
  static async getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    if (userId1 === userId2) {
      throw errors.badRequest("Cannot create conversation with yourself")
    }

    // Check if conversation already exists
    const existingConversation = await query(
      `SELECT c.id, c.type, c.name, c.created_by, c.created_at, c.updated_at
       FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE c.type = 'direct' 
         AND cp1.user_id = $1 AND cp1.left_at IS NULL
         AND cp2.user_id = $2 AND cp2.left_at IS NULL`,
      [userId1, userId2],
    )

    if (existingConversation.rows.length > 0) {
      const conversation = existingConversation.rows[0]
      return await this.getConversationWithParticipants(conversation.id, userId1)
    }

    // Create new conversation
    const result = await transaction(async (client) => {
      // Create conversation
      const conversationResult = await client.query(
        `INSERT INTO conversations (type, created_by) 
         VALUES ('direct', $1) 
         RETURNING id, type, name, created_by, created_at, updated_at`,
        [userId1],
      )

      const conversation = conversationResult.rows[0]

      // Add participants
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) 
         VALUES ($1, $2), ($1, $3)`,
        [conversation.id, userId1, userId2],
      )

      return conversation
    })

    return await this.getConversationWithParticipants(result.id, userId1)
  }

  // Create group conversation
  static async createGroupConversation(
    creatorId: string,
    name: string,
    participantIds: string[],
  ): Promise<Conversation> {
    if (!name || name.trim().length === 0) {
      throw errors.badRequest("Group name is required")
    }

    if (participantIds.length < 2) {
      throw errors.badRequest("Group must have at least 2 participants")
    }

    if (participantIds.length > 100) {
      throw errors.badRequest("Group cannot have more than 100 participants")
    }

    // Remove duplicates and ensure creator is included
    const uniqueParticipants = Array.from(new Set([creatorId, ...participantIds]))

    const result = await transaction(async (client) => {
      // Create conversation
      const conversationResult = await client.query(
        `INSERT INTO conversations (type, name, created_by) 
         VALUES ('group', $1, $2) 
         RETURNING id, type, name, created_by, created_at, updated_at`,
        [name.trim(), creatorId],
      )

      const conversation = conversationResult.rows[0]

      // Add participants
      const participantValues = uniqueParticipants
        .map((userId, index) => {
          const role = userId === creatorId ? "admin" : "member"
          return `($1, $${index + 2}, '${role}')`
        })
        .join(", ")

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role) 
         VALUES ${participantValues}`,
        [conversation.id, ...uniqueParticipants],
      )

      return conversation
    })

    return await this.getConversationWithParticipants(result.id, creatorId)
  }

  // Get conversation with participants
  static async getConversationWithParticipants(conversationId: string, userId: string): Promise<Conversation> {
    // Check cache first
    const cacheKey = cacheKeys.conversation(conversationId)
    const cachedConversation = await cache.get(cacheKey)
    if (cachedConversation) {
      return cachedConversation
    }

    // Verify user is participant
    const participantCheck = await query(
      "SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL",
      [conversationId, userId],
    )

    if (participantCheck.rows.length === 0) {
      throw errors.forbidden("You are not a participant in this conversation")
    }

    // Get conversation details
    const conversationResult = await query(
      "SELECT id, type, name, created_by, created_at, updated_at FROM conversations WHERE id = $1",
      [conversationId],
    )

    if (conversationResult.rows.length === 0) {
      throw errors.notFound("Conversation not found")
    }

    const conversation = conversationResult.rows[0]

    // Get participants
    const participantsResult = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              cp.role, cp.joined_at
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1 AND cp.left_at IS NULL AND u.is_active = true
       ORDER BY cp.joined_at ASC`,
      [conversationId],
    )

    // Get last message
    const lastMessageResult = await query(
      `SELECT m.id, m.content, m.media_url, m.message_type, m.created_at,
              u.username, u.full_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [conversationId],
    )

    // Get unread count for current user
    const unreadResult = await query(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       WHERE m.conversation_id = $1 
         AND m.sender_id != $2 
         AND m.is_deleted = false
         AND NOT EXISTS (
           SELECT 1 FROM message_reads mr 
           WHERE mr.message_id = m.id AND mr.user_id = $2
         )`,
      [conversationId, userId],
    )

    const conversationWithDetails: Conversation = {
      ...conversation,
      participants: participantsResult.rows,
      last_message: lastMessageResult.rows[0] || null,
      unread_count: Number.parseInt(unreadResult.rows[0].unread_count),
    }

    // Cache the conversation
    await cache.set(cacheKey, conversationWithDetails, config.redis.ttl.user)

    return conversationWithDetails
  }

  // Get user conversations
  static async getUserConversations(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<Conversation>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const result = await query(
      `SELECT c.id, c.type, c.name, c.created_by, c.created_at, c.updated_at,
              COUNT(*) OVER() as total_count
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = $1 AND cp.left_at IS NULL
       ORDER BY c.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, validLimit, offset],
    )

    const conversations = await Promise.all(
      result.rows.map(async (row) => {
        return await this.getConversationWithParticipants(row.id, userId)
      }),
    )

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: conversations,
      pagination: paginationMeta,
    }
  }

  // Send message
  static async sendMessage(
    senderId: string,
    conversationId: string,
    messageData: SendMessageRequest,
  ): Promise<Message> {
    const { content, media_url, media_type, message_type, reply_to_id } = messageData

    // Validate message
    if (!content && !media_url) {
      throw errors.badRequest("Message must have content or media")
    }

    if (content && content.length > 4000) {
      throw errors.badRequest("Message content too long (max 4000 characters)")
    }

    // Verify sender is participant
    const participantCheck = await query(
      "SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL",
      [conversationId, senderId],
    )

    if (participantCheck.rows.length === 0) {
      throw errors.forbidden("You are not a participant in this conversation")
    }

    // Verify reply-to message exists (if provided)
    if (reply_to_id) {
      const replyToCheck = await query(
        "SELECT id FROM messages WHERE id = $1 AND conversation_id = $2 AND is_deleted = false",
        [reply_to_id, conversationId],
      )

      if (replyToCheck.rows.length === 0) {
        throw errors.notFound("Reply-to message not found")
      }
    }

    const result = await transaction(async (client) => {
      // Insert message
      const messageResult = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, message_type, reply_to_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, conversation_id, sender_id, content, media_url, media_type, message_type, 
                   reply_to_id, is_deleted, created_at, updated_at`,
        [conversationId, senderId, content, media_url, media_type, message_type, reply_to_id],
      )

      const message = messageResult.rows[0]

      // Update conversation timestamp
      await client.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId])

      return message
    })

    // Get sender info
    const senderResult = await query(
      "SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1",
      [senderId],
    )

    // Get reply-to message if exists
    let replyToMessage = null
    if (reply_to_id) {
      const replyResult = await query(
        `SELECT m.id, m.content, m.media_url, m.message_type, m.created_at,
                u.username, u.full_name
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.id = $1`,
        [reply_to_id],
      )
      replyToMessage = replyResult.rows[0] || null
    }

    const messageWithDetails: Message = {
      ...result,
      sender: senderResult.rows[0],
      reply_to: replyToMessage,
      is_read: false,
    }

    // Clear conversation cache
    await cache.del(cacheKeys.conversation(conversationId))

    // Send real-time message
    const wsService = getWebSocketService()
    wsService.sendMessageToConversation(conversationId, messageWithDetails)

    return messageWithDetails
  }

  // Get conversation messages
  static async getConversationMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<Message>> {
    // Verify user is participant
    const participantCheck = await query(
      "SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL",
      [conversationId, userId],
    )

    if (participantCheck.rows.length === 0) {
      throw errors.forbidden("You are not a participant in this conversation")
    }

    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const result = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.media_url, m.media_type, 
              m.message_type, m.reply_to_id, m.is_deleted, m.created_at, m.updated_at,
              u.id as sender_id, u.username, u.full_name, u.avatar_url, u.is_verified,
              COUNT(*) OVER() as total_count
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1 AND m.is_deleted = false AND u.is_active = true
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, validLimit, offset],
    )

    const messages = await Promise.all(
      result.rows.map(async (row) => {
        const message: Message = {
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          content: row.content,
          media_url: row.media_url,
          media_type: row.media_type,
          message_type: row.message_type,
          reply_to_id: row.reply_to_id,
          is_deleted: row.is_deleted,
          created_at: row.created_at,
          updated_at: row.updated_at,
          sender: {
            id: row.sender_id,
            username: row.username,
            full_name: row.full_name,
            avatar_url: row.avatar_url,
            is_verified: row.is_verified,
          },
        }

        // Get reply-to message if exists
        if (row.reply_to_id) {
          const replyResult = await query(
            `SELECT m.id, m.content, m.media_url, m.message_type, m.created_at,
                    u.username, u.full_name
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.id = $1`,
            [row.reply_to_id],
          )
          message.reply_to = replyResult.rows[0] || null
        }

        // Check if message is read by current user
        const readResult = await query("SELECT id FROM message_reads WHERE message_id = $1 AND user_id = $2", [
          message.id,
          userId,
        ])
        message.is_read = readResult.rows.length > 0

        return message
      }),
    )

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
      pagination: paginationMeta,
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(userId: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return

    // Insert read receipts (ignore duplicates)
    const values = messageIds.map((messageId, index) => `($1, $${index + 2})`).join(", ")

    await query(
      `INSERT INTO message_reads (user_id, message_id) 
       VALUES ${values}
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [userId, ...messageIds],
    )

    // Get conversation ID for cache invalidation
    const conversationResult = await query("SELECT DISTINCT conversation_id FROM messages WHERE id = ANY($1)", [
      messageIds,
    ])

    if (conversationResult.rows.length > 0) {
      const conversationId = conversationResult.rows[0].conversation_id
      await cache.del(cacheKeys.conversation(conversationId))
    }
  }

  // Delete message
  static async deleteMessage(messageId: string, userId: string): Promise<void> {
    const result = await query("UPDATE messages SET is_deleted = true WHERE id = $1 AND sender_id = $2", [
      messageId,
      userId,
    ])

    if (result.rowCount === 0) {
      throw errors.notFound("Message not found or you don't have permission to delete it")
    }

    // Get conversation ID for cache invalidation
    const conversationResult = await query("SELECT conversation_id FROM messages WHERE id = $1", [messageId])
    if (conversationResult.rows.length > 0) {
      const conversationId = conversationResult.rows[0].conversation_id
      await cache.del(cacheKeys.conversation(conversationId))

      // Notify participants about message deletion
      const wsService = getWebSocketService()
      wsService.sendMessageToConversation(conversationId, {
        type: "message_deleted",
        messageId,
        deletedBy: userId,
        timestamp: new Date(),
      })
    }
  }

  // Add participant to group
  static async addParticipant(conversationId: string, adminId: string, newParticipantId: string): Promise<void> {
    // Verify admin permissions
    const adminCheck = await query(
      `SELECT c.type FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE c.id = $1 AND cp.user_id = $2 AND cp.role = 'admin' AND cp.left_at IS NULL`,
      [conversationId, adminId],
    )

    if (adminCheck.rows.length === 0) {
      throw errors.forbidden("Only group admins can add participants")
    }

    // Check if user is already a participant
    const existingParticipant = await query(
      "SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL",
      [conversationId, newParticipantId],
    )

    if (existingParticipant.rows.length > 0) {
      throw errors.conflict("User is already a participant")
    }

    // Add participant
    await query("INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)", [
      conversationId,
      newParticipantId,
    ])

    // Clear cache
    await cache.del(cacheKeys.conversation(conversationId))

    // Send notification
    const wsService = getWebSocketService()
    wsService.sendMessageToConversation(conversationId, {
      type: "participant_added",
      participantId: newParticipantId,
      addedBy: adminId,
      timestamp: new Date(),
    })
  }

  // Remove participant from group
  static async removeParticipant(conversationId: string, adminId: string, participantId: string): Promise<void> {
    // Verify admin permissions
    const adminCheck = await query(
      `SELECT c.type FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE c.id = $1 AND cp.user_id = $2 AND cp.role = 'admin' AND cp.left_at IS NULL`,
      [conversationId, adminId],
    )

    if (adminCheck.rows.length === 0) {
      throw errors.forbidden("Only group admins can remove participants")
    }

    // Cannot remove yourself as admin
    if (adminId === participantId) {
      throw errors.badRequest("Admins cannot remove themselves")
    }

    // Remove participant
    const result = await query(
      "UPDATE conversation_participants SET left_at = NOW() WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, participantId],
    )

    if (result.rowCount === 0) {
      throw errors.notFound("Participant not found")
    }

    // Clear cache
    await cache.del(cacheKeys.conversation(conversationId))

    // Send notification
    const wsService = getWebSocketService()
    wsService.sendMessageToConversation(conversationId, {
      type: "participant_removed",
      participantId,
      removedBy: adminId,
      timestamp: new Date(),
    })
  }

  // Leave conversation
  static async leaveConversation(conversationId: string, userId: string): Promise<void> {
    const result = await query(
      "UPDATE conversation_participants SET left_at = NOW() WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    )

    if (result.rowCount === 0) {
      throw errors.notFound("You are not a participant in this conversation")
    }

    // Clear cache
    await cache.del(cacheKeys.conversation(conversationId))

    // Send notification
    const wsService = getWebSocketService()
    wsService.sendMessageToConversation(conversationId, {
      type: "participant_left",
      participantId: userId,
      timestamp: new Date(),
    })
  }
}
