"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebSocketService = exports.initializeWebSocket = exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const message_1 = __importDefault(require("../models/message"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Store active connections
const activeUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // userId -> socket
class WebSocketService {
    constructor() {
        this.io = null;
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    initialize(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
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
        this.io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = socket.handshake.auth.token || ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                socket.data.userId = decoded.userId;
                console.log(`✅ User ${decoded.userId} authenticated`);
                next();
            }
            catch (error) {
                console.error('❌ WebSocket auth error:', error);
                next(new Error('Authentication error'));
            }
        }));
        // Connection handler
        this.io.on('connection', (socket) => {
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
            socket.on('chat:join', (data) => __awaiter(this, void 0, void 0, function* () {
                const { chatId } = data;
                socket.join(`chat:${chatId}`);
                console.log(`👥 User ${userId} joined chat ${chatId}`);
            }));
            // Handle leaving chat rooms
            socket.on('chat:leave', (data) => {
                const { chatId } = data;
                socket.leave(`chat:${chatId}`);
                console.log(`👋 User ${userId} left chat ${chatId}`);
            });
            // Handle sending messages
            socket.on('message:send', (data) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                try {
                    const { chatId, recipientId, content, type = 'text', mediaUrl, replyTo } = data;
                    // Save message to database
                    const message = new message_1.default({
                        conversation_id: chatId,
                        sender_id: userId,
                        content,
                        message_type: type,
                        media_url: mediaUrl,
                        reply_to_id: replyTo,
                        status: 'sent',
                    });
                    yield message.save();
                    // Populate sender info for real-time update
                    yield message.populate('sender_id', 'username full_name avatar_url');
                    if (replyTo) {
                        yield message.populate('reply_to_id');
                    }
                    // Emit to chat room
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(`chat:${chatId}`).emit('message:received', message);
                    // If 1-on-1 and recipient not in room, emit to their personal room
                    if (recipientId) {
                        (_b = this.io) === null || _b === void 0 ? void 0 : _b.to(`user:${recipientId}`).emit('message:new', message);
                    }
                }
                catch (error) {
                    console.error('Error sending message:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            }));
            // --- WebRTC Signaling for Video & Voice Calls ---
            socket.on('call:start', (data) => {
                var _a;
                const { recipientId, isVideo } = data;
                const recipientSocketId = activeUsers.get(recipientId);
                if (recipientSocketId) {
                    console.log(`📞 Call started from ${userId} to ${recipientId}`);
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(recipientSocketId).emit('call:incoming', {
                        callerId: userId,
                        isVideo
                    });
                }
                else {
                    console.warn(`📞 User ${recipientId} is offline, cannot call`);
                }
            });
            socket.on('call:accept', (data) => {
                var _a;
                const { callerId } = data;
                const callerSocketId = activeUsers.get(callerId);
                if (callerSocketId) {
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(callerSocketId).emit('call:accepted', { acceptorId: userId });
                }
            });
            socket.on('call:reject', (data) => {
                var _a;
                const { callerId } = data;
                const callerSocketId = activeUsers.get(callerId);
                if (callerSocketId) {
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(callerSocketId).emit('call:rejected', { rejectorId: userId });
                }
            });
            socket.on('call:offer', (data) => {
                var _a;
                const { targetUserId, sdp } = data;
                const targetSocketId = activeUsers.get(targetUserId);
                if (targetSocketId) {
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(targetSocketId).emit('call:offer', {
                        senderId: userId,
                        sdp
                    });
                }
            });
            socket.on('call:answer', (data) => {
                var _a;
                const { targetUserId, sdp } = data;
                const targetSocketId = activeUsers.get(targetUserId);
                if (targetSocketId) {
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(targetSocketId).emit('call:answer', {
                        senderId: userId,
                        sdp
                    });
                }
            });
            socket.on('call:ice-candidate', (data) => {
                var _a;
                const { targetUserId, candidate } = data;
                const targetSocketId = activeUsers.get(targetUserId);
                if (targetSocketId) {
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(targetSocketId).emit('call:ice-candidate', {
                        senderId: userId,
                        candidate
                    });
                }
            });
            socket.on('call:end', (data) => {
                var _a;
                const { targetUserId } = data;
                const targetSocketId = activeUsers.get(targetUserId);
                if (targetSocketId) {
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(targetSocketId).emit('call:ended', { userId });
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
    getIO() {
        return this.io;
    }
    sendNotificationToUser(userId, notification) {
        if (this.io) {
            this.io.to(`user:${userId}`).emit('notification:new', notification);
        }
    }
    sendMessageToConversation(conversationId, message) {
        if (this.io) {
            this.io.to(`chat:${conversationId}`).emit('message:new', message);
        }
    }
}
exports.WebSocketService = WebSocketService;
const initializeWebSocket = (httpServer) => {
    const service = WebSocketService.getInstance();
    service.initialize(httpServer);
    return service;
};
exports.initializeWebSocket = initializeWebSocket;
const getWebSocketService = () => {
    return WebSocketService.getInstance();
};
exports.getWebSocketService = getWebSocketService;
