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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.notifyLike = notifyLike;
exports.notifyComment = notifyComment;
exports.notifyFollow = notifyFollow;
exports.notifyMessage = notifyMessage;
exports.notifyMention = notifyMention;
exports.notifyShare = notifyShare;
exports.deletePostNotifications = deletePostNotifications;
exports.deleteCommentNotifications = deleteCommentNotifications;
exports.cleanupDuplicateNotifications = cleanupDuplicateNotifications;
exports.deleteFollowNotification = deleteFollowNotification;
exports.deleteLikeNotification = deleteLikeNotification;
// Notification Helper Functions
const mongodb_1 = require("mongodb");
const firebase_messaging_1 = require("../services/firebase-messaging");
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media';
// Create a notification with Instagram-style deduplication
function createNotification(options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId, actorId, type, postId, commentId, conversationId, content } = options;
            // Don't notify yourself
            if (userId.toString() === actorId.toString()) {
                return null;
            }
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            // Instagram-style deduplication: Check for existing notification from same actor
            // For the same type and target (post/comment/conversation)
            const query = {
                userId: new mongodb_1.ObjectId(userId),
                actorId: new mongodb_1.ObjectId(actorId),
                type
            };
            // Add context-specific filters
            if (postId)
                query.postId = new mongodb_1.ObjectId(postId);
            if (commentId)
                query.commentId = new mongodb_1.ObjectId(commentId);
            if (conversationId)
                query.conversationId = conversationId;
            // Check if notification already exists (within last 24 hours to avoid old duplicates)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const existingNotification = yield db.collection('notifications').findOne(Object.assign(Object.assign({}, query), { createdAt: { $gte: oneDayAgo } }));
            if (existingNotification) {
                // Update existing notification instead of creating duplicate
                yield db.collection('notifications').updateOne({ _id: existingNotification._id }, {
                    $set: {
                        isRead: false, // Mark as unread again
                        updatedAt: new Date(),
                        content: content || existingNotification.content // Update content if provided
                    }
                });
                yield client.close();
                console.log(`♻️ Updated existing notification: ${type} from ${actorId} to ${userId}`);
                return existingNotification._id.toString();
            }
            // Create new notification if no duplicate found
            const notification = {
                userId: new mongodb_1.ObjectId(userId),
                actorId: new mongodb_1.ObjectId(actorId),
                type,
                postId: postId ? new mongodb_1.ObjectId(postId) : undefined,
                commentId: commentId ? new mongodb_1.ObjectId(commentId) : undefined,
                conversationId,
                content,
                isRead: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = yield db.collection('notifications').insertOne(notification);
            // Get actor details for push notification
            const actor = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(actorId) });
            yield client.close();
            console.log(`📬 Notification created: ${type} for user ${userId}`);
            // Send Push Notification (works even when app is closed!)
            if (actor) {
                yield sendPushNotificationToUser(userId.toString(), type, actor, {
                    notificationId: result.insertedId.toString(),
                    postId: postId === null || postId === void 0 ? void 0 : postId.toString(),
                    commentId: commentId === null || commentId === void 0 ? void 0 : commentId.toString(),
                    conversationId,
                    content
                });
            }
            return result.insertedId.toString();
        }
        catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    });
}
// Create like notification
function notifyLike(postOwnerId, actorId, postId) {
    return __awaiter(this, void 0, void 0, function* () {
        return createNotification({
            userId: postOwnerId,
            actorId,
            type: 'like',
            postId
        });
    });
}
// Create comment notification
function notifyComment(postOwnerId, actorId, postId, commentId, commentText) {
    return __awaiter(this, void 0, void 0, function* () {
        return createNotification({
            userId: postOwnerId,
            actorId,
            type: 'comment',
            postId,
            commentId,
            content: commentText.substring(0, 100) // Limit preview length
        });
    });
}
// Create follow notification
function notifyFollow(userId, actorId) {
    return __awaiter(this, void 0, void 0, function* () {
        return createNotification({
            userId,
            actorId,
            type: 'follow'
        });
    });
}
// Create message notification
function notifyMessage(userId, actorId, conversationId, messagePreview) {
    return __awaiter(this, void 0, void 0, function* () {
        return createNotification({
            userId,
            actorId,
            type: 'message',
            conversationId,
            content: messagePreview.substring(0, 100)
        });
    });
}
// Create mention notification
function notifyMention(userId, actorId, postId, content) {
    return __awaiter(this, void 0, void 0, function* () {
        return createNotification({
            userId,
            actorId,
            type: 'mention',
            postId,
            content: content.substring(0, 100)
        });
    });
}
// Create share notification
function notifyShare(postOwnerId, actorId, postId) {
    return __awaiter(this, void 0, void 0, function* () {
        return createNotification({
            userId: postOwnerId,
            actorId,
            type: 'share',
            postId
        });
    });
}
// Delete notifications for a specific post
function deletePostNotifications(postId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            yield db.collection('notifications').deleteMany({
                postId: new mongodb_1.ObjectId(postId)
            });
            yield client.close();
            console.log(`🗑️ Deleted notifications for post ${postId}`);
        }
        catch (error) {
            console.error('Error deleting post notifications:', error);
        }
    });
}
// Delete notifications for a specific comment
function deleteCommentNotifications(commentId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            yield db.collection('notifications').deleteMany({
                commentId: new mongodb_1.ObjectId(commentId)
            });
            yield client.close();
            console.log(`🗑️ Deleted notifications for comment ${commentId}`);
        }
        catch (error) {
            console.error('Error deleting comment notifications:', error);
        }
    });
}
// Clean up duplicate notifications (run this as maintenance)
function cleanupDuplicateNotifications() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            // Find duplicate notifications (same userId, actorId, type, and target within 24 hours)
            const duplicates = yield db.collection('notifications').aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: {
                            userId: '$userId',
                            actorId: '$actorId',
                            type: '$type',
                            postId: '$postId',
                            commentId: '$commentId',
                            conversationId: '$conversationId'
                        },
                        notifications: { $push: '$$ROOT' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $match: { count: { $gt: 1 } }
                }
            ]).toArray();
            let deletedCount = 0;
            // For each group of duplicates, keep the most recent one and delete others
            for (const group of duplicates) {
                const notifications = group.notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                // Keep the first (most recent), delete the rest
                const toDelete = notifications.slice(1).map((n) => n._id);
                if (toDelete.length > 0) {
                    const result = yield db.collection('notifications').deleteMany({
                        _id: { $in: toDelete }
                    });
                    deletedCount += result.deletedCount || 0;
                }
            }
            yield client.close();
            console.log(`🧹 Cleaned up ${deletedCount} duplicate notifications`);
            return deletedCount;
        }
        catch (error) {
            console.error('Error cleaning up duplicate notifications:', error);
            return 0;
        }
    });
}
// Delete follow notification when unfollowed
function deleteFollowNotification(userId, actorId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            yield db.collection('notifications').deleteMany({
                userId: new mongodb_1.ObjectId(userId),
                actorId: new mongodb_1.ObjectId(actorId),
                type: 'follow'
            });
            yield client.close();
            console.log(`🗑️ Deleted follow notification from ${actorId} to ${userId}`);
        }
        catch (error) {
            console.error('Error deleting follow notification:', error);
        }
    });
}
// Delete like notification when unliked
function deleteLikeNotification(postOwnerId, actorId, postId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            yield db.collection('notifications').deleteMany({
                userId: new mongodb_1.ObjectId(postOwnerId),
                actorId: new mongodb_1.ObjectId(actorId),
                type: 'like',
                postId: new mongodb_1.ObjectId(postId)
            });
            yield client.close();
            console.log(`🗑️ Deleted like notification for post ${postId}`);
        }
        catch (error) {
            console.error('Error deleting like notification:', error);
        }
    });
}
// Send Push Notification to user with avatar and name
function sendPushNotificationToUser(userId, type, actor, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const actorName = actor.username || actor.name || 'Someone';
            const actorAvatar = actor.avatar_url || actor.profileImage || '/placeholder-user.jpg';
            let title = '';
            let body = '';
            // Create notification text based on type
            switch (type) {
                case 'like':
                    title = `${actorName} liked your post`;
                    body = 'Tap to view';
                    break;
                case 'comment':
                    title = `${actorName} commented`;
                    body = data.content || 'Tap to view comment';
                    break;
                case 'follow':
                    title = `${actorName} started following you`;
                    body = 'Tap to view profile';
                    break;
                case 'message':
                    title = actorName;
                    body = data.content || 'Sent you a message';
                    break;
                case 'mention':
                    title = `${actorName} mentioned you`;
                    body = data.content || 'Tap to view';
                    break;
                case 'share':
                    title = `${actorName} shared your post`;
                    body = 'Tap to view';
                    break;
                case 'follow_request':
                    title = `${actorName} wants to follow you`;
                    body = 'Tap to respond';
                    break;
                case 'follow_accept':
                    title = `${actorName} accepted your follow request`;
                    body = 'Tap to view profile';
                    break;
                case 'secret_crush_match':
                    title = '💕 You have a Secret Crush match!';
                    body = 'Tap to see who';
                    break;
                case 'secret_crush_ended':
                    title = 'Secret Crush ended';
                    body = `${actorName} removed you from their list`;
                    break;
                default:
                    title = 'New notification';
                    body = 'You have a new notification';
            }
            // Get user's FCM token
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
            yield client.close();
            if (!(user === null || user === void 0 ? void 0 : user.fcmToken)) {
                console.log('⚠️ No FCM token for user:', userId);
                return;
            }
            // Send Firebase push notification with avatar and name
            yield (0, firebase_messaging_1.sendPushNotification)(user.fcmToken, {
                title,
                body,
                data: {
                    type,
                    notificationId: data.notificationId,
                    userId: ((_a = actor._id) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                    username: actorName,
                    avatar: actorAvatar,
                    postId: data.postId || '',
                    commentId: data.commentId || '',
                    conversationId: data.conversationId || '',
                }
            });
            console.log(`🔔 Push notification sent: ${type} to ${userId}`);
        }
        catch (error) {
            console.error('Error sending push notification:', error);
            // Don't throw - notification creation should succeed even if push fails
        }
    });
}
