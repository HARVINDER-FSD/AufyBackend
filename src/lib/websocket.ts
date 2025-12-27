// WebSocket Server - Scalable Real-time Chat with Socket.io
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/message';
import User from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Store active connections
const activeUsers = new Map<string, string>(); // userId -> socketId
const userSockets = new Map<string, Socket>(); // userId -> socket

export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
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
  io.use(async (socket, next) => {
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
  io.on('connection', (socket: Socket) => {
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
        const message = new Message({
          chatId,
          senderId: userId,
          recipientId,
          content,
          type,
          mediaUrl,
          replyTo,
          status: 'sent',
          timestamp: new Date(),
        });

        await message.save();

        // Populate sender info
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'username avatar verified badge_type')
          .populate('replyTo');

        const messageData = {
          id: populatedMessage._id.toString(),
          chatId: populatedMessage.chatId,
          senderId: populatedMessage.senderId,
          recipientId: populatedMessage.recipientId,
          content: populatedMessage.content,
          type: populatedMessage.type,
          mediaUrl: populatedMessage.mediaUrl,
          replyTo: populatedMessage.replyTo,
          status: 'sent',
          timestamp: populatedMessage.timestamp,
          reactions: populatedMessage.reactions || [],
        };

        // Send to recipient if online
        io.to(`user:${recipientId}`).emit('message:receive', messageData);

        // Send confirmation to sender
        socket.emit('message:sent', messageData);

        // Update message status to delivered if recipient is online
        if (activeUsers.has(recipientId)) {
          message.status = 'delivered';
          await message.save();
          
          socket.emit('message:delivered', {
            messageId: message._id.toString(),
            chatId,
          });
        }

        console.log(`📨 Message sent from ${userId} to ${recipientId}`);
      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data: { chatId: string; recipientId: string }) => {
      const { chatId, recipientId } = data;
      io.to(`user:${recipientId}`).emit('typing:start', {
        chatId,
        userId,
      });
    });

    socket.on('typing:stop', (data: { chatId: string; recipientId: string }) => {
      const { chatId, recipientId } = data;
      io.to(`user:${recipientId}`).emit('typing:stop', {
        chatId,
        userId,
      });
    });

    // Handle message read receipts
    socket.on('message:read', async (data: { messageId: string; chatId: string }) => {
      try {
        const { messageId, chatId } = data;
        
        const message = await Message.findById(messageId);
        if (message) {
          message.status = 'read';
          message.readAt = new Date();
          await message.save();

          // Notify sender
          io.to(`user:${message.senderId}`).emit('message:read', {
            messageId,
            chatId,
            readBy: userId,
          });
        }
      } catch (error) {
        console.error('❌ Error marking message as read:', error);
      }
    });

    // Handle message reactions
    socket.on('message:react', async (data: {
      messageId: string;
      chatId: string;
      reaction: string;
    }) => {
      try {
        const { messageId, chatId, reaction } = data;
        
        const message = await Message.findById(messageId);
        if (message) {
          // Toggle reaction
          const existingReaction = message.reactions?.find(
            (r: any) => r.userId === userId && r.emoji === reaction
          );

          if (existingReaction) {
            // Remove reaction
            message.reactions = message.reactions?.filter(
              (r: any) => !(r.userId === userId && r.emoji === reaction)
            );
          } else {
            // Add reaction
            if (!message.reactions) message.reactions = [];
            message.reactions.push({ userId, emoji: reaction });
          }

          await message.save();

          // Broadcast to both users
          io.to(`chat:${chatId}`).emit('message:reacted', {
            messageId,
            chatId,
            reactions: message.reactions,
          });
        }
      } catch (error) {
        console.error('❌ Error reacting to message:', error);
      }
    });

    // Handle message deletion
    socket.on('message:delete', async (data: { messageId: string; chatId: string }) => {
      try {
        const { messageId, chatId } = data;
        
        const message = await Message.findById(messageId);
        if (message && message.senderId.toString() === userId) {
          message.deleted = true;
          message.deletedAt = new Date();
          await message.save();

          // Broadcast deletion
          io.to(`chat:${chatId}`).emit('message:deleted', {
            messageId,
            chatId,
          });
        }
      } catch (error) {
        console.error('❌ Error deleting message:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${userId} (${socket.id})`);
      
      activeUsers.delete(userId);
      userSockets.delete(userId);

      // Broadcast user offline status
      socket.broadcast.emit('user:offline', { userId });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for user ${userId}:`, error);
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
}

// Helper function to check if user is online
export function isUserOnline(userId: string): boolean {
  return activeUsers.has(userId);
}

// Helper function to get online users
export function getOnlineUsers(): string[] {
  return Array.from(activeUsers.keys());
}

// Helper function to send notification to user
export function sendNotificationToUser(userId: string, notification: any) {
  const socket = userSockets.get(userId);
  if (socket) {
    socket.emit('notification', notification);
    return true;
  }
  return false;
}
