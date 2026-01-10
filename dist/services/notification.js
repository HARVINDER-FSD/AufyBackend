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
exports.NotificationService = void 0;
const websocket_1 = require("../lib/websocket");
const utils_1 = require("../lib/utils");
const notification_1 = __importDefault(require("../models/notification"));
const user_1 = __importDefault(require("../models/user"));
class NotificationService {
    // Get unread count
    static getUnreadCount(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield notification_1.default.countDocuments({
                    user_id: userId,
                    is_read: false
                });
                return count;
            }
            catch (error) {
                console.error('Error getting unread count:', error);
                return 0;
            }
        });
    }
    // Create notification
    static createNotification(userId, type, title, content, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const notification = yield notification_1.default.create({
                user_id: userId,
                type,
                title,
                content,
                data,
                is_read: false
            });
            const notifObj = {
                id: notification._id.toString(),
                user_id: notification.user_id.toString(),
                type: notification.type,
                title: notification.title,
                content: notification.content,
                data: notification.data,
                is_read: notification.is_read,
                created_at: notification.created_at,
                updated_at: notification.updated_at
            };
            // Send real-time notification
            const wsService = (0, websocket_1.getWebSocketService)();
            wsService.sendNotificationToUser(userId, notifObj);
            return notifObj;
        });
    }
    // Get user notifications
    static getUserNotifications(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20, unreadOnly = false) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const skip = (validPage - 1) * validLimit;
            const query = { user_id: userId };
            if (unreadOnly) {
                query.is_read = false;
            }
            const total = yield notification_1.default.countDocuments(query);
            const docs = yield notification_1.default.find(query)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(validLimit);
            const notifications = docs.map((doc) => ({
                id: doc._id.toString(),
                user_id: doc.user_id.toString(),
                type: doc.type,
                title: doc.title,
                content: doc.content,
                data: doc.data,
                is_read: doc.is_read,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            }));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: notifications,
                pagination: paginationMeta,
            };
        });
    }
    // Mark notification as read
    static markAsRead(notificationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield notification_1.default.updateOne({ _id: notificationId, user_id: userId }, { is_read: true });
            if (result.matchedCount === 0) {
                throw utils_1.errors.notFound("Notification not found");
            }
        });
    }
    // Mark all notifications as read
    static markAllAsRead(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield notification_1.default.updateMany({ user_id: userId, is_read: false }, { is_read: true });
        });
    }
    // Delete notification
    static deleteNotification(notificationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield notification_1.default.deleteOne({ _id: notificationId, user_id: userId });
            if (result.deletedCount === 0) {
                throw utils_1.errors.notFound("Notification not found");
            }
        });
    }
    // Notification helpers for different events
    static notifyLike(postId, likedByUserId, postOwnerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (likedByUserId === postOwnerId)
                return; // Don't notify self
            const user = yield user_1.default.findById(likedByUserId).select('username full_name');
            if (!user)
                return;
            const displayName = user.full_name || user.username;
            yield this.createNotification(postOwnerId, "like", "New Like", `${displayName} liked your post`, {
                postId,
                likedByUserId,
                likedByUsername: user.username,
                likedByName: displayName,
            });
        });
    }
    static notifyComment(postId, commentedByUserId, postOwnerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (commentedByUserId === postOwnerId)
                return; // Don't notify self
            const user = yield user_1.default.findById(commentedByUserId).select('username full_name');
            if (!user)
                return;
            const displayName = user.full_name || user.username;
            yield this.createNotification(postOwnerId, "comment", "New Comment", `${displayName} commented on your post`, {
                postId,
                commentedByUserId,
                commentedByUsername: user.username,
                commentedByName: displayName,
            });
        });
    }
    static notifyFollow(followerId, followingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield user_1.default.findById(followerId).select('username full_name');
            if (!user)
                return;
            const displayName = user.full_name || user.username;
            yield this.createNotification(followingId, "follow", "New Follower", `${displayName} started following you`, {
                followerId,
                followerUsername: user.username,
                followerName: displayName,
            });
        });
    }
    static notifyFollowRequest(followerId, followingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield user_1.default.findById(followerId).select('username full_name');
            if (!user)
                return;
            const displayName = user.full_name || user.username;
            yield this.createNotification(followingId, "follow_request", "Follow Request", `${displayName} wants to follow you`, {
                followerId,
                followerUsername: user.username,
                followerName: displayName,
            });
        });
    }
    static notifyMessage(conversationId, senderId, recipientId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (senderId === recipientId)
                return; // Don't notify self
            const user = yield user_1.default.findById(senderId).select('username full_name');
            if (!user)
                return;
            const displayName = user.full_name || user.username;
            yield this.createNotification(recipientId, "message", "New Message", `${displayName} sent you a message`, {
                conversationId,
                senderId,
                senderUsername: user.username,
                senderName: displayName,
            });
        });
    }
    // Clean up old notifications (cleanup job)
    static cleanupOldNotifications() {
        return __awaiter(this, arguments, void 0, function* (daysOld = 30) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const result = yield notification_1.default.deleteMany({
                created_at: { $lt: cutoffDate }
            });
            return result.deletedCount || 0;
        });
    }
}
exports.NotificationService = NotificationService;
