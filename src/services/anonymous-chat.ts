import { getRedis, cacheLLen, cacheLPop, cacheRPush, cacheLRem } from "../lib/redis"
import { ChatService } from "./chat"
import { errors } from "../lib/utils"
import MessageModel from "../models/message"
import ConversationModel from "../models/conversation"
import UserModel from "../models/user"
import { getWebSocketService } from "../lib/websocket"
import { ModerationService } from "./moderation"
import { ObjectId } from "mongodb"

export class AnonymousChatService {
  private static QUEUE_PREFIX = "anon_chat_queue:"

  // Get Queue Length (for "Users Online" count)
  static async getQueueLength(interest: string = 'general'): Promise<number> {
    const tag = interest.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const queueKey = `${this.QUEUE_PREFIX}${tag || 'general'}`
    return await cacheLLen(queueKey)
  }

  // Join the random chat queue with Interests (Tags)
  static async joinQueue(userId: string, interests: string[] = []): Promise<{ status: "queued" | "matched", conversationId?: string }> {
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
    const db = await (async () => {
      const { getDatabase } = await import('../lib/database');
      return await getDatabase();
    })();

    const maxPopAttempts = 5; // Avoid infinite loop
    let attempts = 0;

    for (const tag of tags) {
      if (attempts >= maxPopAttempts) break;
      const queueKey = `${this.QUEUE_PREFIX}${tag}`

      while (attempts < maxPopAttempts) {
        partnerId = await cacheLPop(queueKey)
        if (!partnerId) break; // Queue empty for this tag

        attempts++;

        // --- SAFETY CHECKS ---

        // 1. Don't match with self
        if (partnerId === userId) {
          continue; // Discard and try next pop
        }

        // 2. Check if partner is active and hasn't blocked us (or vice versa)
        const partner = await UserModel.findById(partnerId).select('is_active');
        if (!partner || !partner.is_active) {
          continue; // Discard inactive partner
        }

        // 3. Block Check (Mutual)
        const blockExists = await db.collection('blocked_users').findOne({
          $or: [
            { userId: new ObjectId(userId), blockedUserId: new ObjectId(partnerId) },
            { userId: new ObjectId(partnerId), blockedUserId: new ObjectId(userId) }
          ]
        });

        if (blockExists) {
          // Put blocker/blocked guy back at the END of the queue to try someone else?
          // Actually, better to just discard or put back at the END.
          await this.addToQueue(partnerId, tag);
          continue;
        }

        // Match Found!
        matchedTag = tag;
        break;
      }
      if (partnerId && matchedTag) break;
    }

    if (partnerId && matchedTag) {
      // 2. Match found! Create conversation
      const conversation = await this.createAnonymousConversation(userId, partnerId, matchedTag!)

      // Notify partner (via WebSocket)
      const wsService = getWebSocketService();

      wsService.notifyAnonymousMatch(partnerId, {
        conversationId: conversation.id,
        partnerPersona: {
          matchType: 'random',
          topic: matchedTag
        }
      });

      return { status: "matched", conversationId: conversation.id }
    } else {
      // 3. No one waiting or all skipped, add to queue
      await this.addToQueue(userId, tags[0])
      return { status: "queued" }
    }
  }

  // Add user to queue
  private static async addToQueue(userId: string, tag: string) {
    const queueKey = `${this.QUEUE_PREFIX}${tag}`
    await cacheRPush(queueKey, userId)
  }

  // Leave queue
  static async leaveQueue(userId: string, interests: string[] = []) {
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
    await cacheLRem(queueKey, 0, userId)
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
        ],
      })
    }

    // Create Message
    // 🛡️ AI Moderation Check
    await ModerationService.checkContent(content, senderId);

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

  /**
   * Update Reputation based on behavior (Stranger Mode Power)
   */
  static async updateReputation(userId: string, change: number) {
    try {
      await UserModel.findByIdAndUpdate(userId, {
        $inc: { anonymousReputation: change }
      });
      console.log(`[ANON REPUTATION] User ${userId} updated by ${change}`);
    } catch (err) {
      console.error("Failed to update reputation:", err);
    }
  }

  /**
   * Report Stranger (Safety First)
   */
  static async reportStranger(reporterId: string, reportedUserId: string, conversationId: string, reason: string) {
    const db = await (async () => {
      const { getDatabase } = await import('../lib/database');
      return await getDatabase();
    })();

    // 1. Save Report
    await db.collection('anonymous_reports').insertOne({
      reporterId: new ObjectId(reporterId),
      reportedUserId: new ObjectId(reportedUserId),
      conversationId: new ObjectId(conversationId),
      reason,
      created_at: new Date()
    });

    // 2. Penalize Reputation (-20 points for a report)
    await this.updateReputation(reportedUserId, -20);

    // 3. Auto-block them from each other in Random Chat
    await db.collection('blocked_users').insertOne({
      userId: new ObjectId(reporterId),
      blockedUserId: new ObjectId(reportedUserId),
      createdAt: new Date(),
      type: 'anonymous'
    });

    // 4. End conversation
    await this.endAnonymousConversation(conversationId, reporterId);
  }
}
