"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
exports.initializeWebSocket = initializeWebSocket;
exports.getWebSocketService = getWebSocketService;
const socket_io_1 = require("socket.io");
const utils_1 = require("./utils");
const database_1 = require("./database");
const config_1 = require("./config");
class WebSocketService {
    constructor(server) {
        this.connectedUsers = new Map(); // userId -> Set of socketIds
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
            },
            pingInterval: config_1.config.websocket.pingInterval,
            pingTimeout: config_1.config.websocket.pingTimeout,
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        this.setupRedisSubscription();
    }
    setupMiddleware() {
        // Authentication middleware
        this.io.use((socket, next) => {
            try {
                const authToken = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
                if (!authToken) {
                    return next(new Error("Authentication token required"));
                }
                const payload = utils_1.token.verify(authToken);
                socket.userId = payload.userId;
                socket.username = payload.username;
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
            socket.on("mark_messages_read", (data) => {
                // Broadcast read receipt to other participants
                socket.to(`conversation:${data.conversationId}`).emit("messages_read", {
                    userId: socket.userId,
                    username: socket.username,
                    conversationId: data.conversationId,
                    messageIds: data.messageIds,
                    readAt: new Date(),
                });
            });
            // Handle user status updates
            socket.on("update_status", (status) => {
                if (socket.userId) {
                    this.broadcastUserStatus(socket.userId, status);
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
    setupRedisSubscription() {
        // Subscribe to Redis channels for cross-server communication
        database_1.redisSub.subscribe("chat_message", "notification", "user_status");
        database_1.redisSub.on("message", (channel, message) => {
            try {
                const data = JSON.parse(message);
                switch (channel) {
                    case "chat_message":
                        this.handleChatMessage(data);
                        break;
                    case "notification":
                        this.handleNotification(data);
                        break;
                    case "user_status":
                        this.handleUserStatusUpdate(data);
                        break;
                }
            }
            catch (error) {
                console.error("Error processing Redis message:", error);
            }
        });
    }
    handleChatMessage(data) {
        // Emit message to conversation participants
        this.io.to(`conversation:${data.conversationId}`).emit("new_message", data);
    }
    handleNotification(data) {
        // Send notification to specific user
        this.io.to(`user:${data.userId}`).emit("notification", data);
    }
    handleUserStatusUpdate(data) {
        // Broadcast user status to all connected clients
        this.io.emit("user_status_update", data);
    }
    // Public methods for sending messages
    sendMessageToConversation(conversationId, message) {
        // Publish to Redis for cross-server support
        database_1.redisPub.publish("chat_message", JSON.stringify({ ...message, conversationId }));
    }
    sendNotificationToUser(userId, notification) {
        // Publish to Redis for cross-server support
        database_1.redisPub.publish("notification", JSON.stringify({ ...notification, userId }));
    }
    broadcastUserStatus(userId, status) {
        const statusData = {
            userId,
            status,
            timestamp: new Date(),
        };
        // Publish to Redis for cross-server support
        database_1.redisPub.publish("user_status", JSON.stringify(statusData));
    }
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
    getOnlineUsers() {
        return Array.from(this.connectedUsers.keys());
    }
    getUserSocketCount(userId) {
        return this.connectedUsers.get(userId)?.size || 0;
    }
}
exports.WebSocketService = WebSocketService;
// Export singleton instance
let wsService;
function initializeWebSocket(server) {
    if (!wsService) {
        wsService = new WebSocketService(server);
    }
    return wsService;
}
function getWebSocketService() {
    if (!wsService) {
        throw new Error("WebSocket service not initialized");
    }
    return wsService;
}
