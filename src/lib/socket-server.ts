import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';

interface AuthenticatedSocket extends SocketIOServer.Socket {
  userId?: string;
  username?: string;
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(server: HTTPServer) {
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
          this.io.to(`conversation:${message.conversation_id}`).emit("message_reaction", {
            messageId: data.messageId,
            userId: socket.userId,
            emoji: data.emoji,
            reactions: message.reactions
          });
        } catch (error) {
          console.error("Error adding reaction:", error);
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
    messageType: string;
    mediaUrl?: string;
    replyTo?: string;
  }) {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    // Get conversation participants
    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(data.conversationId)
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Find recipient (other participant)
    const recipientId = conversation.participants.find((p: any) => 
      p.toString() !== data.senderId
    );

    const message = {
      conversation_id: new ObjectId(data.conversationId),
      sender_id: new ObjectId(data.senderId),
      recipient_id: new ObjectId(recipientId),
      content: data.content,
      message_type: data.messageType,
      media_url: data.mediaUrl || null,
      is_read: false,
      reactions: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('messages').insertOne(message);
    
    // Update conversation's updated_at
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(data.conversationId) },
      { $set: { updated_at: new Date() } }
    );

    await client.close();

    return {
      _id: result.insertedId,
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
    });

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

