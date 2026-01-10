// WebSocket Server - Scalable Real-time Chat with Socket.io
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import MessageModel from '../models/message';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Store active connections
const activeUsers = new Map<string, string>(); // userId -> socketId
const userSockets = new Map<string, Socket>(); // userId -> socket

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
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

      // Broadcast user online status
      socket.broadcast.emit('user:online', { userId });

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Handle joining chat rooms
      socket.on('chat:join', async (data: { chatId: string }) => {
        const { chatId } = data;
        socket.join(`chat:${chatId}`);
        console.log(`👥 User ${userId} joined chat ${chatId}`);
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

          // Save message to database
          const message = new MessageModel({
            conversation_id: chatId,
            sender_id: userId,
            content,
            message_type: type,
            media_url: mediaUrl,
            reply_to_id: replyTo,
            status: 'sent',
          });

          await message.save();
          
          // Populate sender info for real-time update
          await message.populate('sender_id', 'username full_name avatar_url');
          if (replyTo) {
             await message.populate('reply_to_id');
          }

          // Emit to chat room
          this.io?.to(`chat:${chatId}`).emit('message:received', message);
          
          // If 1-on-1 and recipient not in room, emit to their personal room
          if (recipientId) {
             this.io?.to(`user:${recipientId}`).emit('message:new', message);
          }

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
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

  public sendMessageToConversation(conversationId: string, message: any) {
    if (this.io) {
      this.io.to(`chat:${conversationId}`).emit('message:new', message);
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
