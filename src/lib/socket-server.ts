import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors'; // enables async error propagation

// Middleware imports
import { requestId, httpLogger } from '../middleware/logger';
import { errorHandler } from '../middleware/errorHandler';
import { securityHeaders, corsOptions } from '../middleware/security';
import { apiLimiter } from '../middleware/rateLimiter';
import { messagesQueue } from '../lib/queue';
import { sendPushNotification } from '../lib/push-service';

// Route imports (add more as needed)
import usersRouter from '../routes/users';
import chatRouter from '../routes/chat';
import reelsRouter from '../routes/reels';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private app: express.Application; // Express app for HTTP routes

  constructor(server: HTTPServer) {
    // Initialize Express app
    this.app = express();

    // Apply global middlewares (order matters)
    this.app.use(corsOptions);
    this.app.use(securityHeaders);
    this.app.use(express.json({ limit: '2mb' }));
    this.app.use(requestId);
    this.app.use(httpLogger);
    this.app.use(apiLimiter as any);

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', ts: Date.now() });
    });

    // Mount API routers
    this.app.use('/api/users', usersRouter);
    this.app.use('/api/chat', chatRouter);
    this.app.use('/api/reels', reelsRouter);

    // Global error handler (must be last)
    this.app.use(errorHandler);

    // Initialize Socket.IO server
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : "*",
        methods: ["GET", "POST"],
      },
      pingInterval: 25000,
      pingTimeout: 60000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const authToken = socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(" ")[1];

        if (!authToken) {
          return next(new Error("Authentication token required"));
        }

        const decoded = jwt.verify(authToken, JWT_SECRET) as any;
        socket.userId = decoded.userId;
        socket.username = decoded.username;

        next();
      } catch (error) {
        next(new Error("Invalid authentication token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.username} connected with socket ${socket.id}`);

      // Track connected user
      if (socket.userId) {
        if (!this.connectedUsers.has(socket.userId)) {
          this.connectedUsers.set(socket.userId, new Set());
        }
        this.connectedUsers.get(socket.userId)!.add(socket.id);

        // Join user's personal room
        socket.join(`user:${socket.userId}`);

        // Broadcast user online status
        this.broadcastUserStatus(socket.userId, "online");
      }

      // Handle joining conversation rooms
      socket.on("join_conversation", (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${socket.username} joined conversation ${conversationId}`);
      });

      // Handle leaving conversation rooms
      socket.on("leave_conversation", (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        console.log(`User ${socket.username} left conversation ${conversationId}`);
      });

      // Handle sending messages
      socket.on("send_message", async (data: {
        conversationId: string;
        content: string;
        messageType?: string;
        mediaUrl?: string;
        replyTo?: string;
      }) => {
        try {
          const message = await this.saveMessage({
            conversationId: data.conversationId,
            senderId: socket.userId!,
            content: data.content,
            messageType: data.messageType || 'text',
            mediaUrl: data.mediaUrl,
            replyTo: data.replyTo
          });

          // Broadcast message to conversation participants
          this.io.to(`conversation:${data.conversationId}`).emit("new_message", message);
          
          // Send Push Notification to recipient
          const recipientId = (message as any).recipient_id;
          if (recipientId && recipientId.toString() !== socket.userId) {
             sendPushNotification(recipientId.toString(), {
               title: socket.username || "New Message",
               body: data.content,
               type: 'message',
               channelId: 'messages',
               categoryId: 'message.new', // Enable "Reply" and "Like" actions on client
               data: {
                 conversationId: data.conversationId,
                 messageId: (message as any)._id,
                 action: 'reply'
               }
             }).catch(err => console.error("Error sending message push:", err));
          }
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("message_error", { error: "Failed to send message" });
        }
      });

      // Handle typing indicators
      socket.on("typing_start", (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
          userId: socket.userId,
          username: socket.username,
          conversationId: data.conversationId,
        });
      });

      socket.on("typing_stop", (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit("user_stopped_typing", {
          userId: socket.userId,
          username: socket.username,
          conversationId: data.conversationId,
        });
      });

      // Handle message read receipts
      socket.on("mark_messages_read", async (data: { conversationId: string; messageIds: string[] }) => {
        try {
          await this.markMessagesAsRead(data.messageIds, socket.userId!);

          // Broadcast read receipt to other participants
          socket.to(`conversation:${data.conversationId}`).emit("messages_read", {
            userId: socket.userId,
            username: socket.username,
            conversationId: data.conversationId,
            messageIds: data.messageIds,
            readAt: new Date(),
          });
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      });

      // Handle reactions
      socket.on("add_reaction", async (data: { messageId: string; emoji: string }) => {
        try {
          const message = await this.addReaction(data.messageId, socket.userId!, data.emoji);

          // Broadcast reaction to conversation
          const convId = (message as any).conversation_id;
          this.io.to(`conversation:${convId}`).emit("message_reaction", {
            messageId: data.messageId,
            userId: socket.userId,
            emoji: data.emoji,
            reactions: message.reactions
          });
        } catch (error) {
          console.error("Error adding reaction:", error);
        }
      });

      // --- Call Signaling Events (WebRTC/Agora) ---

      // 1. Initiate Call
      socket.on("call:start", (data: { recipientId: string; isVideo: boolean; offer?: any }) => {
        const recipientSocketIds = this.connectedUsers.get(data.recipientId);
        
        if (recipientSocketIds && recipientSocketIds.size > 0) {
          // User is online, ring them
          recipientSocketIds.forEach(socketId => {
            this.io.to(socketId).emit("incoming_call", {
              callerId: socket.userId,
              callerName: socket.username,
              isVideo: data.isVideo,
              offer: data.offer,
              callId: new ObjectId().toString() // Unique ID for this call session
            });
          });
        } else {
          // User is offline, send Push Notification (VoIP/System)
          console.log(`User ${data.recipientId} is offline. Sending Call Push Notification.`);
          
          sendPushNotification(data.recipientId, {
            title: `Incoming Call`,
            body: `${socket.username} is calling you...`,
            type: 'call',
            channelId: 'calls',
            data: {
              type: 'call_start',
              callerId: socket.userId,
              callerName: socket.username,
              isVideo: data.isVideo,
              callId: new ObjectId().toString()
            }
          }).catch(err => console.error("Error sending call push:", err));
        }
      });

      // 2. Accept Call
      socket.on("call:accept", (data: { callerId: string; answer?: any }) => {
        const callerSocketIds = this.connectedUsers.get(data.callerId);
        if (callerSocketIds) {
          callerSocketIds.forEach(socketId => {
            this.io.to(socketId).emit("call_accepted", {
              responderId: socket.userId,
              answer: data.answer
            });
          });
        }
      });

      // 3. Reject Call
      socket.on("call:reject", (data: { callerId: string; reason?: string }) => {
        const callerSocketIds = this.connectedUsers.get(data.callerId);
        if (callerSocketIds) {
          callerSocketIds.forEach(socketId => {
            this.io.to(socketId).emit("call_rejected", {
              responderId: socket.userId,
              reason: data.reason || "busy"
            });
          });
        }
      });

      // 4. End Call
      socket.on("call:end", (data: { otherUserId: string }) => {
        const otherSocketIds = this.connectedUsers.get(data.otherUserId);
        if (otherSocketIds) {
          otherSocketIds.forEach(socketId => {
            this.io.to(socketId).emit("call_ended", {
              enderId: socket.userId
            });
          });
        }
      });

      // 5. ICE Candidate (for pure WebRTC fallback, optional if using Agora)
      socket.on("call:ice-candidate", (data: { targetUserId: string; candidate: any }) => {
        const targetSocketIds = this.connectedUsers.get(data.targetUserId);
        if (targetSocketIds) {
          targetSocketIds.forEach(socketId => {
            this.io.to(socketId).emit("ice_candidate", {
              senderId: socket.userId,
              candidate: data.candidate
            });
          });
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User ${socket.username} disconnected`);

        if (socket.userId) {
          const userSockets = this.connectedUsers.get(socket.userId);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.connectedUsers.delete(socket.userId);
              // Broadcast user offline status after a delay
              setTimeout(() => {
                if (!this.connectedUsers.has(socket.userId!)) {
                  this.broadcastUserStatus(socket.userId!, "offline");
                }
              }, 5000); // 5 second delay to handle quick reconnections
            }
          }
        }
      });
    });
  }

  private async saveMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
    messageType?: string;
    mediaUrl?: string;
    replyTo?: string;
  }) {
    const messageId = new ObjectId();
    const createdAt = new Date();
    
    return this.queueMessage({
      _id: messageId,
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      messageType: data.messageType || 'text',
      mediaUrl: data.mediaUrl,
      replyTo: data.replyTo,
      createdAt: createdAt
    });
  }

  private async queueMessage(data: {
    _id: ObjectId;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: string;
    mediaUrl?: string;
    replyTo?: string;
    createdAt: Date;
  }) {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    // Get conversation participants (Fast Read)
    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(data.conversationId)
    });

    await client.close();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Find recipient (other participant)
    const recipientId = conversation.participants.find((p: any) =>
      p.user.toString() !== data.senderId
    )?.user;

    const message = {
      _id: data._id,
      conversation_id: new ObjectId(data.conversationId),
      sender_id: new ObjectId(data.senderId),
      recipient_id: recipientId ? new ObjectId(recipientId) : null,
      content: data.content,
      message_type: data.messageType,
      media_url: data.mediaUrl || null,
      is_read: false,
      reactions: [],
      created_at: data.createdAt,
      updated_at: data.createdAt
    };

    // Push to Queue for Async Write (Makhan Mode)
    if (messagesQueue) {
        await messagesQueue.add('new_message', {
            _id: data._id.toString(),
            conversation_id: data.conversationId,
            sender_id: data.senderId,
            content: data.content,
            message_type: data.messageType,
            media_url: data.mediaUrl,
            reply_to_id: data.replyTo,
            status: 'sent',
            created_at: data.createdAt
        });
    } else {
        console.error("Messages queue not initialized, falling back to direct write");
        // Fallback code could go here, but queue should be init
    }

    return {
      _id: data._id,
      ...message,
      conversation_id: data.conversationId,
      sender_id: data.senderId,
      recipient_id: recipientId
    };
  }

  private async markMessagesAsRead(messageIds: string[], userId: string) {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    await db.collection('messages').updateMany(
      {
        _id: { $in: messageIds.map(id => new ObjectId(id)) },
        recipient_id: new ObjectId(userId)
      },
      {
        $set: {
          is_read: true,
          read_at: new Date()
        }
      }
    );

    await client.close();
  }

  private async addReaction(messageId: string, userId: string, emoji: string) {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    const message = await db.collection('messages').findOne({
      _id: new ObjectId(messageId)
    }) as any;

    if (!message) {
      throw new Error("Message not found");
    }

    // Remove existing reaction from this user
    const updatedReactions = message.reactions.filter((reaction: any) =>
      reaction.user_id.toString() !== userId
    );

    // Add new reaction
    updatedReactions.push({
      user_id: new ObjectId(userId),
      emoji: emoji,
      created_at: new Date()
    });

    await db.collection('messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { reactions: updatedReactions } }
    );

    await client.close();

    return {
      ...message,
      reactions: updatedReactions
    };
  }

  private broadcastUserStatus(userId: string, status: string) {
    const statusData = {
      userId,
      status,
      timestamp: new Date(),
    };

    this.io.emit("user_status_update", statusData);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
}

// Export singleton instance
let socketService: SocketService;

export function initializeSocket(server: HTTPServer): SocketService {
  if (!socketService) {
    socketService = new SocketService(server);
  }
  return socketService;
}

export function getSocketService(): SocketService {
  if (!socketService) {
    throw new Error("Socket service not initialized");
  }
  return socketService;
}

// Expose the Express app for external use (e.g., for testing or adding more routes later)
export function getExpressApp(): express.Application {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService['app']; // access private app via bracket notation
}
