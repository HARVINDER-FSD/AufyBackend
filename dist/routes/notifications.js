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
// Notifications API Routes
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const anonymous_utils_1 = require("../lib/anonymous-utils");
const auth_1 = __importDefault(require("../middleware/auth"));
const authenticate = auth_1.default;
const router = express_1.default.Router();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media';
// GET /api/notifications - Get all notifications for current user
router.get('/', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { limit = 50, skip = 0, unreadOnly = false } = req.query;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const query = { userId: new mongodb_1.ObjectId(userId) };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }
        // Get notifications with actor details
        const notifications = yield db.collection('notifications')
            .aggregate([
            { $match: query },
            { $sort: { createdAt: -1 } },
            { $skip: Number(skip) },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'actorId',
                    foreignField: '_id',
                    as: 'actor'
                }
            },
            { $unwind: '$actor' },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'postId',
                    foreignField: '_id',
                    as: 'post'
                }
            },
            {
                $project: {
                    _id: 1,
                    type: 1,
                    content: 1,
                    postId: 1,
                    conversationId: 1,
                    isRead: 1,
                    is_anonymous: 1, // Include anonymous flag
                    createdAt: 1,
                    'actor._id': 1,
                    'actor.username': 1,
                    'actor.full_name': 1,
                    'actor.avatar': 1,
                    'actor.avatar_url': 1,
                    'actor.verified': 1,
                    'actor.is_verified': 1,
                    'post._id': { $arrayElemAt: ['$post._id', 0] },
                    'post.image_url': { $arrayElemAt: ['$post.image_url', 0] },
                    'post.media': { $arrayElemAt: ['$post.media', 0] }
                }
            }
        ])
            .toArray();
        // Get unread count
        const unreadCount = yield db.collection('notifications').countDocuments({
            userId: new mongodb_1.ObjectId(userId),
            isRead: false
        });
        yield client.close();
        // Format notifications
        const formattedNotifications = notifications.map(notif => {
            var _a, _b, _c;
            return ({
                id: notif._id.toString(),
                type: notif.type,
                user: (0, anonymous_utils_1.maskAnonymousUser)({
                    id: notif.actor._id.toString(),
                    username: notif.actor.username,
                    avatar: notif.actor.avatar_url || notif.actor.avatar || '/placeholder-user.jpg',
                    avatar_url: notif.actor.avatar_url || notif.actor.avatar || '/placeholder-user.jpg',
                    verified: notif.actor.is_verified || notif.actor.verified || false,
                    is_verified: notif.actor.is_verified || notif.actor.verified || false,
                    is_anonymous: notif.is_anonymous
                }),
                content: notif.content,
                post: ((_a = notif.post) === null || _a === void 0 ? void 0 : _a._id) ? {
                    id: notif.post._id.toString(),
                    image: notif.post.image_url || ((_c = (_b = notif.post.media) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.url)
                } : undefined,
                conversationId: notif.conversationId,
                timestamp: getTimeAgo(notif.createdAt),
                isRead: notif.isRead
            });
        });
        res.json({
            notifications: formattedNotifications,
            unreadCount,
            hasMore: notifications.length === Number(limit)
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch notifications' });
    }
}));
// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const unreadCount = yield db.collection('notifications').countDocuments({
            userId: new mongodb_1.ObjectId(userId),
            isRead: false
        });
        yield client.close();
        res.json({ unreadCount });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: error.message || 'Failed to get unread count' });
    }
}));
// PUT /api/notifications/:notificationId/read - Mark notification as read
router.put('/:notificationId/read', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { notificationId } = req.params;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const result = yield db.collection('notifications').updateOne({
            _id: new mongodb_1.ObjectId(notificationId),
            userId: new mongodb_1.ObjectId(userId)
        }, {
            $set: {
                isRead: true,
                updatedAt: new Date()
            }
        });
        yield client.close();
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ message: error.message || 'Failed to mark notification as read' });
    }
}));
// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        yield db.collection('notifications').updateMany({
            userId: new mongodb_1.ObjectId(userId),
            isRead: false
        }, {
            $set: {
                isRead: true,
                updatedAt: new Date()
            }
        });
        yield client.close();
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ message: error.message || 'Failed to mark all notifications as read' });
    }
}));
// DELETE /api/notifications/:notificationId - Delete notification
router.delete('/:notificationId', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { notificationId } = req.params;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const result = yield db.collection('notifications').deleteOne({
            _id: new mongodb_1.ObjectId(notificationId),
            userId: new mongodb_1.ObjectId(userId)
        });
        yield client.close();
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted' });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ message: error.message || 'Failed to delete notification' });
    }
}));
// Helper function to format time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60)
        return 'just now';
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800)
        return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
}
exports.default = router;
