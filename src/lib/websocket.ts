// WebSocket Server - Scalable Real-time Chat with Socket.io
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import MessageModel from '../models/message';
import UserModel from '../models/user';
import { addJob, QUEUE_NAMES } from '../lib/queue';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Store active connections
const activeUsers = new Map<string, string>(); // userId -> socketId
const userSockets = new Map<string, Socket>(); // userId -> socket

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;

  private constructor() { }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public sendMessageToConversation(conversationId: string, message: any) {
    if (!this.io) return;
    this.io.to(`chat:${conversationId}`).emit('message:received', message);
  }

  public notifyAnonymousMatch(userId: string, data: { conversationId: string; partnerPersona: any }) {
    if (!this.io) return;
    // Send to user's personal room
    this.io.to(`user:${userId}`).emit('anonymous:matched', data);
  }

  public initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        socket.data.userId = decoded.userId;

        // Cache user info in socket for fast message composition
        const user = await UserModel.findById(decoded.userId).select('username full_name avatar_url').lean();
        if (user) {
          socket.data.user = user;
        }

        console.log(`✅ User ${decoded.userId} authenticated`);
        next();
      } catch (error) {
        console.error('❌ WebSocket auth error:', error);
        next(new Error('Authentication error'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId;
      console.log(`🔌 User connected: ${userId} (${socket.id})`);

      // Store user connection
      activeUsers.set(userId, socket.id);
      userSockets.set(userId, socket);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Broadcast user online status to everyone
      socket.broadcast.emit('user:online', { userId });

      // Handle joining chat rooms
      socket.on('chat:join', async (data: { chatId: string }) => {
        const { chatId } = data;

        // 🛡️ SECURITY CHECK: Verify user is a participant before joining room
        try {
          const Conversation = require('../models/conversation').default;
          const conversation = await Conversation.findOne({
            _id: chatId,
            'participants.user': userId,
            'participants.left_at': null
          });

          if (!conversation) {
            console.warn(`🛡️ User ${userId} tried to join room ${chatId} without permission`);
            socket.emit('error', { message: 'Access denied: You are not a participant of this conversation' });
            return;
          }

          socket.join(`chat:${chatId}`);
          console.log(`👥 User ${userId} joined chat ${chatId}`);
        } catch (error) {
          console.error('Error joining chat:', error);
          socket.emit('error', { message: 'Failed to join chat' });
        }
      });

      // Handle leaving chat rooms
      socket.on('chat:leave', (data: { chatId: string }) => {
        const { chatId } = data;
        socket.leave(`chat:${chatId}`);
        console.log(`👋 User ${userId} left chat ${chatId}`);
      });

      // Handle sending messages
      socket.on('message:send', async (data: {
        chatId: string;
        recipientId: string;
        content: string;
        type?: string;
        mediaUrl?: string;
        replyTo?: string;
      }) => {
        try {
          const { chatId, recipientId, content, type = 'text', mediaUrl, replyTo } = data;

          const messageId = new ObjectId();
          const createdAt = new Date();

          // Construct message object for immediate emit (Optimistic Update)
          // We use the cached user info from socket.data.user to avoid a DB call
          const messageData = {
            _id: messageId,
            conversation_id: chatId,
            sender_id: socket.data.user || { _id: userId }, // Populated sender
            content,
            message_type: type,
            media_url: mediaUrl,
            reply_to_id: replyTo, // Ideally this should be populated too if possible, but ID is okay for now
            status: 'sent',
            created_at: createdAt,
            updated_at: createdAt,
            is_deleted: false,
            reactions: [],
            read_by: []
          };

          // Emit to chat room IMMEDIATELY
          // This ensures "Makhan" (smooth) experience - 0ms perceived latency
          this.io?.to(`chat:${chatId}`).emit('message:received', messageData);

          // If 1-on-1 and recipient not in room, emit to their personal room
          if (recipientId) {
            this.io?.to(`user:${recipientId}`).emit('message:new', messageData);
          }

          // Async Persistence: Offload DB write to worker
          await addJob(QUEUE_NAMES.MESSAGES, 'save-message', {
            _id: messageId.toString(),
            conversation_id: chatId,
            sender_id: userId,
            content,
            message_type: type,
            media_url: mediaUrl,
            reply_to_id: replyTo,
            status: 'sent',
            created_at: createdAt
          });

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // --- WebRTC Signaling for Video & Voice Calls ---

      socket.on('call:start', (data: { recipientId: string; isVideo: boolean }) => {
        const { recipientId, isVideo } = data;
        const recipientSocketId = activeUsers.get(recipientId);

        if (recipientSocketId) {
          console.log(`📞 Call started from ${userId} to ${recipientId}`);
          this.io?.to(recipientSocketId).emit('call:incoming', {
            callerId: userId,
            isVideo
          });
        } else {
          console.warn(`📞 User ${recipientId} is offline, cannot call`);
        }
      });

      socket.on('call:accept', (data: { callerId: string }) => {
        const { callerId } = data;
        const callerSocketId = activeUsers.get(callerId);
        if (callerSocketId) {
          this.io?.to(callerSocketId).emit('call:accepted', { acceptorId: userId });
        }
      });

      socket.on('call:reject', (data: { callerId: string }) => {
        const { callerId } = data;
        const callerSocketId = activeUsers.get(callerId);
        if (callerSocketId) {
          this.io?.to(callerSocketId).emit('call:rejected', { rejectorId: userId });
        }
      });

      socket.on('call:offer', (data: { targetUserId: string; sdp: any }) => {
        const { targetUserId, sdp } = data;
        const targetSocketId = activeUsers.get(targetUserId);
        if (targetSocketId) {
          this.io?.to(targetSocketId).emit('call:offer', {
            senderId: userId,
            sdp
          });
        }
      });

      socket.on('call:answer', (data: { targetUserId: string; sdp: any }) => {
        const { targetUserId, sdp } = data;
        const targetSocketId = activeUsers.get(targetUserId);
        if (targetSocketId) {
          this.io?.to(targetSocketId).emit('call:answer', {
            senderId: userId,
            sdp
          });
        }
      });

      socket.on('call:ice-candidate', (data: { targetUserId: string; candidate: any }) => {
        const { targetUserId, candidate } = data;
        const targetSocketId = activeUsers.get(targetUserId);
        if (targetSocketId) {
          this.io?.to(targetSocketId).emit('call:ice-candidate', {
            senderId: userId,
            candidate
          });
        }
      });

      socket.on('call:end', (data: { targetUserId: string }) => {
        const { targetUserId } = data;
        const targetSocketId = activeUsers.get(targetUserId);
        if (targetSocketId) {
          this.io?.to(targetSocketId).emit('call:ended', { userId });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${userId}`);
        activeUsers.delete(userId);
        userSockets.delete(userId);
        socket.broadcast.emit('user:offline', { userId });
      });
    });
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  public sendNotificationToUser(userId: string, notification: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification:new', notification);
    }
  }

}

export const initializeWebSocket = (httpServer: HTTPServer) => {
  const service = WebSocketService.getInstance();
  service.initialize(httpServer);
  return service;
};

export const getWebSocketService = () => {
  return WebSocketService.getInstance();
};
