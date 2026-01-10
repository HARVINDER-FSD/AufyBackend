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
const express_1 = require("express");
const database_1 = require("../lib/database");
const user_1 = __importDefault(require("../models/user"));
const auth_1 = require("../middleware/auth");
const expo_server_sdk_1 = require("expo-server-sdk");
const router = (0, express_1.Router)();
const expo = new expo_server_sdk_1.Expo();
// Save push token
router.post('/token', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { pushToken, platform } = req.body;
        const userId = req.userId;
        if (!pushToken) {
            return res.status(400).json({
                success: false,
                error: 'Push token is required',
            });
        }
        // Validate Expo push token
        if (!expo_server_sdk_1.Expo.isExpoPushToken(pushToken)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Expo push token',
            });
        }
        // Update user with push token
        yield user_1.default.findByIdAndUpdate(userId, {
            pushToken,
            pushTokenPlatform: platform,
            pushTokenUpdatedAt: new Date(),
        });
        res.json({
            success: true,
            message: 'Push token saved successfully',
        });
    }
    catch (error) {
        console.error('Error saving push token:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to save push token',
        });
    }
}));
// Send push notification
router.post('/send', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { userId, notification } = req.body;
        if (!userId || !notification) {
            return res.status(400).json({
                success: false,
                error: 'User ID and notification data are required',
            });
        }
        // Get user's push token
        const user = yield user_1.default.findById(userId);
        if (!user || !user.pushToken) {
            return res.status(404).json({
                success: false,
                error: 'User not found or no push token registered',
            });
        }
        // Validate push token
        if (!expo_server_sdk_1.Expo.isExpoPushToken(user.pushToken)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid push token',
            });
        }
        // Create push message
        const message = {
            to: user.pushToken,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            badge: 1,
            channelId: getChannelId(notification.type),
        };
        // Send push notification
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = yield expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }
            catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }
        res.json({
            success: true,
            message: 'Push notification sent',
            tickets,
        });
    }
    catch (error) {
        console.error('Error sending push notification:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send push notification',
        });
    }
}));
// Send bulk push notifications
router.post('/send-bulk', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { userIds, notification } = req.body;
        if (!userIds || !Array.isArray(userIds) || !notification) {
            return res.status(400).json({
                success: false,
                error: 'User IDs array and notification data are required',
            });
        }
        // Get users' push tokens
        const users = yield user_1.default.find({
            _id: { $in: userIds },
            pushToken: { $exists: true, $ne: null },
        });
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No users with push tokens found',
            });
        }
        // Create push messages
        const messages = users
            .filter(user => expo_server_sdk_1.Expo.isExpoPushToken(user.pushToken))
            .map(user => ({
            to: user.pushToken,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            badge: 1,
            channelId: getChannelId(notification.type),
        }));
        // Send push notifications in chunks
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = yield expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }
            catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }
        res.json({
            success: true,
            message: `Push notifications sent to ${messages.length} users`,
            tickets,
        });
    }
    catch (error) {
        console.error('Error sending bulk push notifications:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send push notifications',
        });
    }
}));
// Helper function to get Android channel ID based on notification type
function getChannelId(type) {
    switch (type) {
        case 'message':
            return 'messages';
        case 'like':
        case 'comment':
            return 'likes';
        case 'follow':
        case 'follow_request':
        case 'follow_accept':
            return 'follows';
        default:
            return 'default';
    }
}
exports.default = router;
