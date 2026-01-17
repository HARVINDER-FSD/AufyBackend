"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const queue_1 = require("../lib/queue");
const logger_1 = require("../middleware/logger");
const expo_server_sdk_1 = require("expo-server-sdk");
const database_1 = require("../lib/database");
const mongodb_1 = require("mongodb");
const expo = new expo_server_sdk_1.Expo();
const connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    tls: ((_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.startsWith('rediss://')) ? {} : undefined,
});
// 1. Notification Worker
const notificationWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.NOTIFICATIONS, (job) => __awaiter(void 0, void 0, void 0, function* () {
    const { recipientId, title, body, data } = job.data;
    const db = yield (0, database_1.getDatabase)();
    const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(recipientId) });
    if (!user || !user.pushToken) {
        logger_1.logger.debug(`No push token for user ${recipientId}, skipping push.`);
        return;
    }
    if (!expo_server_sdk_1.Expo.isExpoPushToken(user.pushToken)) {
        logger_1.logger.error(`Invalid push token for user ${recipientId}: ${user.pushToken}`);
        return;
    }
    const messages = [{
            to: user.pushToken,
            sound: 'default',
            title: title || 'New Notification',
            body: body || 'You have a new activity on Anufy',
            data: data || {},
        }];
    try {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            yield expo.sendPushNotificationsAsync(chunk);
        }
        logger_1.logger.info(`Successfully sent push notification to ${recipientId}`);
    }
    catch (error) {
        logger_1.logger.error(`Error sending push notification to ${recipientId}:`, error);
    }
}), { connection });
// 2. Feed Update Worker (Invalidates cache for followers)
const feedUpdateWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.FEED_UPDATES, (job) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, type } = job.data;
    const db = yield (0, database_1.getDatabase)();
    const { cacheInvalidate } = yield Promise.resolve().then(() => __importStar(require('../lib/redis')));
    if (type === 'new_post') {
        // When someone posts, we might want to invalidate their followers' feeds
        const followers = yield db.collection('follows').find({
            following_id: new mongodb_1.ObjectId(userId),
            status: 'accepted'
        }).toArray();
        for (const follow of followers) {
            const followerId = follow.follower_id.toString();
            yield cacheInvalidate(`feed:${followerId}:*`);
        }
        logger_1.logger.info(`Invalidated feeds for ${followers.length} followers of ${userId}`);
    }
}), { connection });
// Error handling for workers
notificationWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Notification Job ${job === null || job === void 0 ? void 0 : job.id} failed:`, err);
});
feedUpdateWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Feed Update Job ${job === null || job === void 0 ? void 0 : job.id} failed:`, err);
});
logger_1.logger.info('🚀 Background Workers Started Successfully');
