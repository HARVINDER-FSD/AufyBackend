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
exports.SocketService = void 0;
exports.initializeSocket = initializeSocket;
exports.getSocketService = getSocketService;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongodb_1 = require("mongodb");
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';
class SocketService {
    constructor(server) {
        this.connectedUsers = new Map(); // userId -> Set of socketIds
        this.io = new socket_io_1.Server(server, {
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
    setupMiddleware() {
        // Authentication middleware
        this.io.use((socket, next) => {
            var _a;
            try {
                const authToken = socket.handshake.auth.token ||
                    ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
                if (!authToken) {
                    return next(new Error("Authentication token required"));
                }
                const decoded = jsonwebtoken_1.default.verify(authToken, JWT_SECRET);
                socket.userId = decoded.userId;
                socket.username = decoded.username;
                next();
            }
            catch (error) {
                next(new Error("Invalid authentication token"));
            }
        });
    }
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            console.log(`User ${socket.username} connected with socket ${socket.id}`);
            // Track connected user
            if (socket.userId) {
                if (!this.connectedUsers.has(socket.userId)) {
                    this.connectedUsers.set(socket.userId, new Set());
                }
                this.connectedUsers.get(socket.userId).add(socket.id);
                // Join user's personal room
                socket.join(`user:${socket.userId}`);
                // Broadcast user online status
                this.broadcastUserStatus(socket.userId, "online");
            }
            // Handle joining conversation rooms
            socket.on("join_conversation", (conversationId) => {
                socket.join(`conversation:${conversationId}`);
                console.log(`User ${socket.username} joined conversation ${conversationId}`);
            });
            // Handle leaving conversation rooms
            socket.on("leave_conversation", (conversationId) => {
                socket.leave(`conversation:${conversationId}`);
                console.log(`User ${socket.username} left conversation ${conversationId}`);
            });
            // Handle sending messages
            socket.on("send_message", (data) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const message = yield this.saveMessage({
                        conversationId: data.conversationId,
                        senderId: socket.userId,
                        content: data.content,
                        messageType: data.messageType || 'text',
                        mediaUrl: data.mediaUrl,
                        replyTo: data.replyTo
                    });
                    // Broadcast message to conversation participants
                    this.io.to(`conversation:${data.conversationId}`).emit("new_message", message);
                }
                catch (error) {
                    console.error("Error sending message:", error);
                    socket.emit("message_error", { error: "Failed to send message" });
                }
            }));
            // Handle typing indicators
            socket.on("typing_start", (data) => {
                socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
                    userId: socket.userId,
                    username: socket.username,
                    conversationId: data.conversationId,
                });
            });
            socket.on("typing_stop", (data) => {
                socket.to(`conversation:${data.conversationId}`).emit("user_stopped_typing", {
                    userId: socket.userId,
                    username: socket.username,
                    conversationId: data.conversationId,
                });
            });
            // Handle message read receipts
            socket.on("mark_messages_read", (data) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.markMessagesAsRead(data.messageIds, socket.userId);
                    // Broadcast read receipt to other participants
                    socket.to(`conversation:${data.conversationId}`).emit("messages_read", {
                        userId: socket.userId,
                        username: socket.username,
                        conversationId: data.conversationId,
                        messageIds: data.messageIds,
                        readAt: new Date(),
                    });
                }
                catch (error) {
                    console.error("Error marking messages as read:", error);
                }
            }));
            // Handle reactions
            socket.on("add_reaction", (data) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const message = yield this.addReaction(data.messageId, socket.userId, data.emoji);
                    // Broadcast reaction to conversation
                    this.io.to(`conversation:${message.conversation_id}`).emit("message_reaction", {
                        messageId: data.messageId,
                        userId: socket.userId,
                        emoji: data.emoji,
                        reactions: message.reactions
                    });
                }
                catch (error) {
                    console.error("Error adding reaction:", error);
                }
            }));
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
                                if (!this.connectedUsers.has(socket.userId)) {
                                    this.broadcastUserStatus(socket.userId, "offline");
                                }
                            }, 5000); // 5 second delay to handle quick reconnections
                        }
                    }
                }
            });
        });
    }
    saveMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            // Get conversation participants
            const conversation = yield db.collection('conversations').findOne({
                _id: new mongodb_1.ObjectId(data.conversationId)
            });
            if (!conversation) {
                throw new Error("Conversation not found");
            }
            // Find recipient (other participant)
            const recipientId = conversation.participants.find((p) => p.toString() !== data.senderId);
            const message = {
                conversation_id: new mongodb_1.ObjectId(data.conversationId),
                sender_id: new mongodb_1.ObjectId(data.senderId),
                recipient_id: new mongodb_1.ObjectId(recipientId),
                content: data.content,
                message_type: data.messageType,
                media_url: data.mediaUrl || null,
                is_read: false,
                reactions: [],
                created_at: new Date(),
                updated_at: new Date()
            };
            const result = yield db.collection('messages').insertOne(message);
            // Update conversation's updated_at
            yield db.collection('conversations').updateOne({ _id: new mongodb_1.ObjectId(data.conversationId) }, { $set: { updated_at: new Date() } });
            yield client.close();
            return Object.assign(Object.assign({ _id: result.insertedId }, message), { conversation_id: data.conversationId, sender_id: data.senderId, recipient_id: recipientId });
        });
    }
    markMessagesAsRead(messageIds, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            yield db.collection('messages').updateMany({
                _id: { $in: messageIds.map(id => new mongodb_1.ObjectId(id)) },
                recipient_id: new mongodb_1.ObjectId(userId)
            }, {
                $set: {
                    is_read: true,
                    read_at: new Date()
                }
            });
            yield client.close();
        });
    }
    addReaction(messageId, userId, emoji) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            const message = yield db.collection('messages').findOne({
                _id: new mongodb_1.ObjectId(messageId)
            });
            if (!message) {
                throw new Error("Message not found");
            }
            // Remove existing reaction from this user
            const updatedReactions = message.reactions.filter((reaction) => reaction.user_id.toString() !== userId);
            // Add new reaction
            updatedReactions.push({
                user_id: new mongodb_1.ObjectId(userId),
                emoji: emoji,
                created_at: new Date()
            });
            yield db.collection('messages').updateOne({ _id: new mongodb_1.ObjectId(messageId) }, { $set: { reactions: updatedReactions } });
            yield client.close();
            return Object.assign(Object.assign({}, message), { reactions: updatedReactions });
        });
    }
    broadcastUserStatus(userId, status) {
        const statusData = {
            userId,
            status,
            timestamp: new Date(),
        };
        this.io.emit("user_status_update", statusData);
    }
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
    getOnlineUsers() {
        return Array.from(this.connectedUsers.keys());
    }
    getUserSocketCount(userId) {
        var _a;
        return ((_a = this.connectedUsers.get(userId)) === null || _a === void 0 ? void 0 : _a.size) || 0;
    }
}
exports.SocketService = SocketService;
// Export singleton instance
let socketService;
function initializeSocket(server) {
    if (!socketService) {
        socketService = new SocketService(server);
    }
    return socketService;
}
function getSocketService() {
    if (!socketService) {
        throw new Error("Socket service not initialized");
    }
    return socketService;
}
