import { getRedis } from "../lib/redis"
import { ChatService } from "./chat"
import { errors } from "../lib/utils"
import MessageModel from "../models/message"
import ConversationModel from "../models/conversation"
import UserModel from "../models/user"
import { getWebSocketService } from "../lib/websocket"
import { ModerationService } from "./moderation"

export class AnonymousChatService {
  private static QUEUE_PREFIX = "anon_chat_queue:"

  // Get Queue Length (for "Users Online" count)
  static async getQueueLength(interest: string = 'general'): Promise<number> {
    const redis = getRedis()
    if (!redis) return 0
    const tag = interest.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const queueKey = `${this.QUEUE_PREFIX}${tag || 'general'}`
    if ('llen' in redis) {
        return await redis.llen(queueKey)
    }
    return 0
  }

  // Join the random chat queue with Interests (Tags)
  static async joinQueue(userId: string, interests: string[] = []): Promise<{ status: "queued" | "matched", conversationId?: string }> {
    const redis = getRedis()
    if (!redis) {
      throw errors.internal("Chat service unavailable")
    }

    // Check Reputation
    const user = await UserModel.findById(userId);
    if (!user) throw errors.notFound("User not found");
    
    // Default to 100 if undefined
    const reputation = user.anonymousReputation !== undefined ? user.anonymousReputation : 100;
    
    if (reputation < 50) {
        throw errors.forbidden("Your anonymous reputation is too low to join random chat.");
    }

    // Normalize interests (lowercase, trim, max 5, max length 20, no special chars)
    // We allow any alphanumeric tag now for "Omegle++" experience
    const tags = interests
      .map(t => t.toLowerCase().trim().replace(/[^a-z0-9]/g, '')) // Remove non-alphanumeric
      .filter(t => t.length > 0 && t.length <= 20)
      .slice(0, 5); // Max 5 tags
    
    // If no valid tags, default to "general"
    if (tags.length === 0) tags.push("general")

    // Try to find a match in any of the tags
    let partnerId: string | null = null
    let matchedTag: string | null = null

    for (const tag of tags) {
      const queueKey = `${this.QUEUE_PREFIX}${tag}`
      if ('lpop' in redis) {
        partnerId = await redis.lpop(queueKey) as string | null
        if (partnerId) {
          matchedTag = tag
          break // Found a match!
        }
      }
    }

    // Ensure we don't match with ourselves (if user spams join)
    if (partnerId === userId) {
      // Put it back and wait
      await this.addToQueue(userId, tags[0]) // Wait in primary tag
      return { status: "queued" }
    }

    if (partnerId) {
      // 2. Match found! Create conversation
      // Check if partner is still available (sanity check)
      // Create conversation
      const conversation = await this.createAnonymousConversation(userId, partnerId, matchedTag!)
      
      // Notify partner (via WebSocket)
      const wsService = getWebSocketService();
      
      // We need to fetch the persona of the user who initiated the match (userId) to show to partnerId
      // And vice versa.
      // For simplicity, let's just send the conversation ID and let frontend fetch details.
      // OR better: send the masked persona right away.
      
      wsService.notifyAnonymousMatch(partnerId, { 
        conversationId: conversation.id,
        partnerPersona: { 
            // In a real app, we'd fetch the user's persona. 
            // For now, let frontend handle the "loading" or fetch conversation details.
            // We can just say "You matched!"
            matchType: 'random',
            topic: matchedTag
        } 
      });

      return { status: "matched", conversationId: conversation.id }
    } else {
      // 3. No one waiting, add to queue
      // We only add to the FIRST tag queue to avoid duplication/race conditions
      // (User waits in their primary interest)
      await this.addToQueue(userId, tags[0])
      return { status: "queued" }
    }
  }

  // Add user to queue
  private static async addToQueue(userId: string, tag: string) {
    const redis = getRedis()
    if (!redis) return
    const queueKey = `${this.QUEUE_PREFIX}${tag}`
    
    if ('rpush' in redis) {
      await redis.rpush(queueKey, userId)
    }
  }

  // Leave queue
  static async leaveQueue(userId: string, interests: string[] = []) {
    const redis = getRedis()
    if (!redis) return

    // If interests provided, try to remove from those specific queues
    // If not, we might need to know which queue they are in.
    // Ideally, frontend sends the same tags they joined with.
    
    const tags = interests.length > 0 ? interests : ["general"]
    
    // We only put them in the FIRST tag queue in joinQueue, so we only remove from there
    // Ensure tag is valid
    let primaryTag = tags[0].toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (primaryTag.length === 0 || primaryTag.length > 20) {
        primaryTag = 'general'
    }
    
    const queueKey = `${this.QUEUE_PREFIX}${primaryTag}`
    
    // Removing specific item from list is O(N), but queue is expected to be short (matches happen fast)
    if ('lrem' in redis) {
      await redis.lrem(queueKey, 0, userId)
    }
  }

  // End Anonymous Conversation (Skip/Next or User Leaves)
  static async endAnonymousConversation(conversationId: string, endedByUserId: string) {
     const conversation = await ConversationModel.findById(conversationId);
     if (!conversation) return;

     const now = new Date();
     // Set left_at for ALL participants to effectively close it
     conversation.participants.forEach(p => {
        if (!p.left_at) {
             p.left_at = now;
        }
     });
     
     await conversation.save();

     // Notify all participants
     const wsService = getWebSocketService();
     wsService.sendMessageToConversation(conversationId, {
        type: 'conversation_ended',
        endedBy: endedByUserId,
        timestamp: now
     });
  }

  // Create Anonymous Conversation
  private static async createAnonymousConversation(user1: string, user2: string, topic: string) {
    const conversation = await ConversationModel.create({
      type: 'direct',
      name: `Anonymous Chat - ${topic}`,
      created_by: user1,
      participants: [
        { user: user1, role: 'member', joined_at: new Date() },
        { user: user2, role: 'member', joined_at: new Date() }
      ],
      is_anonymous: true
    })

    return conversation
  }

  // Send Anonymous Request (Direct to Creator)
  static async sendAnonymousRequest(senderId: string, recipientId: string, content: string) {
    // 1. Check if there is already a conversation
    let conversation = await ConversationModel.findOne({
      type: 'direct',
      participants: { $all: [{ $elemMatch: { user: senderId } }, { $elemMatch: { user: recipientId } }] }
    })

    // 2. Rate Limit Check (3 messages per day per creator)
    if (conversation) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const requestCount = await MessageModel.countDocuments({
        sender_id: senderId,
        conversation_id: conversation._id,
        is_anonymous: true,
        created_at: { $gte: oneDayAgo }
      });

      if (requestCount >= 3) {
        throw errors.forbidden("Daily limit reached. You can only send 3 anonymous messages to this creator per day.");
      }
    }

    if (!conversation) {
      conversation = await ConversationModel.create({
        type: 'direct',
        created_by: senderId,
        participants: [
          { user: senderId, role: 'member', joined_at: new Date() },
          { user: recipientId, role: 'member', joined_at: new Date() }
        ]
      })
    }

    // Create Message
    // Moderation Check
    await ModerationService.checkContent(content);

    const message = await MessageModel.create({
      conversation_id: conversation._id,
      sender_id: senderId,
      content: content,
      message_type: 'text',
      is_anonymous: true,
      status: 'request' // Important: It goes to "Request" folder
    })

    return message
  }
}
