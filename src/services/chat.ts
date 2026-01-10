import { cache } from "../lib/database"
import { getWebSocketService } from "../lib/websocket"
import type { Conversation, Message, SendMessageRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"
import ConversationModel from "../models/conversation"
import MessageModel from "../models/message"
import UserModel from "../models/user"
import mongoose from "mongoose"

export class ChatService {
  // Create or get direct conversation
  static async getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    if (userId1 === userId2) {
      throw errors.badRequest("Cannot create conversation with yourself")
    }

    // Check if conversation already exists
    // We want a direct conversation where BOTH users are participants
    const existingConversation = await ConversationModel.findOne({
        type: 'direct',
        $and: [
            { 'participants.user': userId1 },
            { 'participants.user': userId2 }
        ]
    });

    if (existingConversation) {
      return await this.getConversationWithParticipants(existingConversation._id.toString(), userId1)
    }

    // Create new conversation
    const newConversation = await ConversationModel.create({
        type: 'direct',
        created_by: userId1,
        participants: [
            { user: userId1, role: 'member', joined_at: new Date() },
            { user: userId2, role: 'member', joined_at: new Date() }
        ]
    });

    return await this.getConversationWithParticipants(newConversation._id.toString(), userId1)
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

    const participants = uniqueParticipants.map(userId => ({
        user: userId,
        role: userId === creatorId ? 'admin' : 'member',
        joined_at: new Date()
    }));

    const newConversation = await ConversationModel.create({
        type: 'group',
        name: name.trim(),
        created_by: creatorId,
        participants
    });

    return await this.getConversationWithParticipants(newConversation._id.toString(), creatorId)
  }

  // Get conversation with participants
  static async getConversationWithParticipants(conversationId: string, userId: string): Promise<Conversation> {
    // Check cache first
    const cacheKey = cacheKeys.conversation(conversationId)
    const cachedConversation = await cache.get(cacheKey)
    if (cachedConversation) {
      return cachedConversation as Conversation
    }

    // Get conversation details
    const conversation = await ConversationModel.findById(conversationId)
        .populate('participants.user', 'username full_name avatar_url is_verified')
        .populate({
            path: 'last_message',
            populate: { path: 'sender_id', select: 'username full_name' }
        });

    if (!conversation) {
      throw errors.notFound("Conversation not found")
    }

    // Verify user is participant
    const participant = conversation.participants.find(p => p.user && (p.user as any)._id.toString() === userId && !p.left_at);
    if (!participant) {
      throw errors.forbidden("You are not a participant in this conversation")
    }

    // Get unread count for current user
    const unreadCount = await MessageModel.countDocuments({
      conversation_id: conversationId,
      sender_id: { $ne: userId },
      is_deleted: false,
      'read_by.user_id': { $ne: userId }
    });

    // Format response
    // Map Mongoose document to Conversation interface
    // Note: The interface in types.ts expects `last_message` as Message type.
    // My Mongoose model has `last_message` as ObjectId or populated doc.
    
    let lastMessage: any = null;
    if (conversation.last_message) {
        const lm = conversation.last_message as any;
        lastMessage = {
            id: lm._id.toString(),
            content: lm.content,
            media_url: lm.media_url,
            message_type: lm.message_type,
            created_at: lm.created_at,
            sender: lm.sender_id ? {
                username: lm.sender_id.username,
                full_name: lm.sender_id.full_name
            } : null
        };
    }

    const participants = conversation.participants
        .filter(p => !p.left_at)
        .map(p => {
            const u = p.user as any;
            return {
                id: u._id.toString(),
                username: u.username,
                full_name: u.full_name,
                avatar_url: u.avatar_url,
                is_verified: u.is_verified,
                role: p.role,
                joined_at: p.joined_at
            };
        });

    const conversationWithDetails: Conversation = {
      id: conversation._id.toString(),
      type: conversation.type as "direct" | "group",
      name: conversation.name,
      created_by: conversation.created_by.toString(),
      created_at: (conversation as any).created_at, // timestamps
      updated_at: (conversation as any).updated_at,
      participants: participants as any, // Cast to avoid strict type issues with User interface
      last_message: lastMessage,
      unread_count: unreadCount,
    }

    // Cache the conversation
    await cache.set(cacheKey, conversationWithDetails, config.redis.ttl.user)

    return conversationWithDetails
  }

  // Get user conversations
  static async getUserConversations(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<Conversation>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const skip = (validPage - 1) * validLimit;

    // Find conversations where user is a participant and hasn't left
    const query = {
        'participants': {
            $elemMatch: {
                user: userId,
                left_at: null
            }
        }
    };

    const total = await ConversationModel.countDocuments(query);
    const conversationsDocs = await ConversationModel.find(query)
        .sort({ updated_at: -1 }) // or updatedAt
        .skip(skip)
        .limit(validLimit);

    const conversations = await Promise.all(
      conversationsDocs.map(async (doc) => {
        return await this.getConversationWithParticipants(doc._id.toString(), userId)
      }),
    )

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

    // Verify conversation exists and user is participant
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
        throw errors.notFound("Conversation not found");
    }

    const isParticipant = conversation.participants.some(p => 
        p.user.toString() === senderId && !p.left_at
    );

    if (!isParticipant) {
      throw errors.forbidden("You are not a participant in this conversation")
    }

    // Verify reply-to message exists (if provided)
    if (reply_to_id) {
      const replyTo = await MessageModel.findOne({
          _id: reply_to_id,
          conversation_id: conversationId,
          is_deleted: false
      });

      if (!replyTo) {
        throw errors.notFound("Reply-to message not found")
      }
    }

    // Create message
    const newMessage = await MessageModel.create({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        media_url,
        media_type,
        message_type: message_type || 'text',
        reply_to_id
    });

    // Update conversation timestamp and last message
    conversation.last_message = newMessage._id as any;
    // Mongoose handles updatedAt automatically on save
    await conversation.save();

    // Get sender info
    const sender = await UserModel.findById(senderId).select('username full_name avatar_url is_verified');

    // Get reply-to message details if exists
    let replyToMessage = null;
    if (reply_to_id) {
        const rt = await MessageModel.findById(reply_to_id).populate('sender_id', 'username full_name');
        if (rt) {
             replyToMessage = {
                id: rt._id.toString(),
                content: rt.content,
                media_url: rt.media_url,
                message_type: rt.message_type,
                created_at: rt.created_at,
                sender: rt.sender_id ? {
                    username: (rt.sender_id as any).username,
                    full_name: (rt.sender_id as any).full_name
                } : null
            };
        }
    }

    const messageWithDetails: Message = {
      id: newMessage._id.toString(),
      conversation_id: conversationId,
      sender_id: senderId,
      content: newMessage.content,
      media_url: newMessage.media_url,
      media_type: newMessage.media_type as any,
      message_type: newMessage.message_type as any,
      reply_to_id: newMessage.reply_to_id ? newMessage.reply_to_id.toString() : undefined,
      is_deleted: newMessage.is_deleted,
      created_at: newMessage.created_at,
      updated_at: newMessage.updated_at,
      sender: sender ? {
          id: sender._id.toString(),
          username: sender.username,
          full_name: sender.full_name,
          avatar_url: sender.avatar_url,
          is_verified: sender.is_verified
      } : undefined,
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
    // Verify conversation and participation
    const conversation = await ConversationModel.findOne({
        _id: conversationId,
        'participants': { $elemMatch: { user: userId, left_at: null } }
    });

    if (!conversation) {
      throw errors.forbidden("You are not a participant in this conversation or it doesn't exist")
    }

    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const skip = (validPage - 1) * validLimit;

    const query = {
        conversation_id: conversationId,
        is_deleted: false
    };

    const total = await MessageModel.countDocuments(query);
    
    // Get messages with sender info
    const messagesDocs = await MessageModel.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(validLimit)
        .populate('sender_id', 'username full_name avatar_url is_verified')
        .populate({
            path: 'reply_to_id',
            populate: { path: 'sender_id', select: 'username full_name' }
        });

    const messages = await Promise.all(
      messagesDocs.map(async (doc) => {
        const sender = doc.sender_id as any;
        
        // Construct reply_to object
        let replyTo = null;
        if (doc.reply_to_id) {
            const rt = doc.reply_to_id as any;
            replyTo = {
                id: rt._id.toString(),
                content: rt.content,
                media_url: rt.media_url,
                message_type: rt.message_type,
                created_at: rt.created_at,
                sender: rt.sender_id ? {
                    username: rt.sender_id.username,
                    full_name: rt.sender_id.full_name
                } : null
            };
        }

        // Check is_read
        const isRead = doc.read_by && doc.read_by.some(r => r.user_id.toString() === userId);

        const message: Message = {
          id: doc._id.toString(),
          conversation_id: doc.conversation_id.toString(),
          sender_id: doc.sender_id._id.toString(),
          content: doc.content,
          media_url: doc.media_url,
          media_type: doc.media_type as any,
          message_type: doc.message_type as any,
          reply_to_id: doc.reply_to_id ? (doc.reply_to_id as any)._id.toString() : undefined,
          is_deleted: doc.is_deleted,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          sender: {
            id: sender._id.toString(),
            username: sender.username,
            full_name: sender.full_name,
            avatar_url: sender.avatar_url,
            is_verified: sender.is_verified,
          },
          reply_to: replyTo,
          is_read: !!isRead
        }

        return message
      }),
    )

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

    // Update messages to add user to read_by array if not already present
    await MessageModel.updateMany(
        { 
            _id: { $in: messageIds },
            'read_by.user_id': { $ne: userId } // Only if not already read by this user
        },
        {
            $addToSet: { 
                read_by: { 
                    user_id: userId,
                    read_at: new Date()
                } 
            }
        }
    );

    // Get conversation IDs for cache invalidation
    const messages = await MessageModel.find({ _id: { $in: messageIds } }).distinct('conversation_id');
    
    for (const conversationId of messages) {
        await cache.del(cacheKeys.conversation(conversationId.toString()));
    }
  }

  // Delete message
  static async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await MessageModel.findOne({ _id: messageId, sender_id: userId });

    if (!message) {
      throw errors.notFound("Message not found or you don't have permission to delete it")
    }

    message.is_deleted = true;
    await message.save();

    const conversationId = message.conversation_id.toString();
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

  // Add participant to group
  static async addParticipant(conversationId: string, adminId: string, newParticipantId: string): Promise<void> {
    // Verify admin permissions
    const conversation = await ConversationModel.findOne({
        _id: conversationId,
        'participants': {
            $elemMatch: {
                user: adminId,
                role: 'admin',
                left_at: null
            }
        }
    });

    if (!conversation) {
      throw errors.forbidden("Only group admins can add participants")
    }

    // Check if user is already a participant
    const existingParticipant = conversation.participants.find(p => p.user.toString() === newParticipantId && !p.left_at);
    if (existingParticipant) {
      throw errors.conflict("User is already a participant")
    }

    // Add participant
    // Check if they were previously a participant and left
    const oldParticipantIndex = conversation.participants.findIndex(p => p.user.toString() === newParticipantId);
    if (oldParticipantIndex > -1) {
        conversation.participants[oldParticipantIndex].left_at = undefined;
        conversation.participants[oldParticipantIndex].joined_at = new Date();
    } else {
        conversation.participants.push({
            user: newParticipantId as any,
            role: 'member',
            joined_at: new Date()
        });
    }

    await conversation.save();

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
    const conversation = await ConversationModel.findOne({
        _id: conversationId,
        'participants': {
            $elemMatch: {
                user: adminId,
                role: 'admin',
                left_at: null
            }
        }
    });

    if (!conversation) {
      throw errors.forbidden("Only group admins can remove participants")
    }

    // Cannot remove yourself as admin
    if (adminId === participantId) {
      throw errors.badRequest("Admins cannot remove themselves")
    }

    // Remove participant
    const participantIndex = conversation.participants.findIndex(p => p.user.toString() === participantId && !p.left_at);
    if (participantIndex === -1) {
      throw errors.notFound("Participant not found")
    }

    conversation.participants[participantIndex].left_at = new Date();
    await conversation.save();

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
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
        throw errors.notFound("Conversation not found");
    }

    const participantIndex = conversation.participants.findIndex(p => p.user.toString() === userId && !p.left_at);
    if (participantIndex === -1) {
      throw errors.notFound("You are not a participant in this conversation")
    }

    conversation.participants[participantIndex].left_at = new Date();
    await conversation.save();

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
