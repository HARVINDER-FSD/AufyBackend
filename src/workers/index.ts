import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES } from '../lib/queue';
import { logger } from '../middleware/logger';
import { Expo } from 'expo-server-sdk';
import { getDatabase } from '../lib/database';
import { ObjectId } from 'mongodb';
import { setupLikeWorker } from './like-worker';
import { setupChatWorker } from './chat-worker';
import NotificationModel from '../models/notification';
import { getChannelId } from '../lib/push-service';

const expo = new Expo();

let connection: Redis | null = null;
let workersInitialized = false;

// Redis explicitly disabled by user
logger.info('🛡️  Offline Mode: Workers Redis explicitly disabled by user, workers disabled');
connection = null;
workersInitialized = false;

/*
try {
    connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        ...
*/

// Initialize specialized workers
setupLikeWorker(connection);
setupChatWorker(connection);

const workerSettings = {
    connection,
    stalledInterval: 60000, // Check for stalled jobs every 60s instead of 30s
    lockDuration: 60000,    // Keep locks longer to reduce renewal commands
    drainDelay: 10          // Wait 10s before checking for new jobs when empty
};

// 1. Notification Worker
const notificationWorker = connection ? new Worker(QUEUE_NAMES.NOTIFICATIONS, async (job: Job) => {
    const { recipientId, title, body, data } = job.data;

    // Save In-App Notification
    try {
        await NotificationModel.create({
            user_id: recipientId,
            actor_id: data?.actorId,
            type: data?.type || 'system',
            title: title,
            content: body,
            data: data,
            is_anonymous: data?.isAnonymous || false,
            is_read: false
        });
        logger.info(`Saved in-app notification for ${recipientId}`);
    } catch (dbError) {
        logger.error(`Failed to save in-app notification for ${recipientId}:`, dbError);
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(recipientId) });

    if (!user || !user.pushToken) {
        logger.debug(`No push token for user ${recipientId}, skipping push.`);
        return;
    }

    if (!Expo.isExpoPushToken(user.pushToken)) {
        logger.error(`Invalid push token for user ${recipientId}: ${user.pushToken}`);
        return;
    }

    const messages: any[] = [{
        to: user.pushToken,
        sound: 'default',
        title: title || 'New Notification',
        body: body || 'You have a new activity on Anufy',
        data: {
            ...data,
            _displayInForeground: true // Moved to data for correct typing
        },
        priority: 'high',
        badge: 1,
        channelId: getChannelId(data?.type || 'default'),
    }];

    try {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
        logger.info(`Successfully sent push notification to ${recipientId}`);
    } catch (error) {
        logger.error(`Error sending push notification to ${recipientId}:`, error);
    }
}, workerSettings) : null;

// 2. Feed Update Worker (Invalidates cache for followers)
const feedUpdateWorker = connection ? new Worker(QUEUE_NAMES.FEED_UPDATES, async (job: Job) => {
    const { userId, type, postId, reelId } = job.data;
    const db = await getDatabase();

    // 🛡️ SHADOWBAN CHECK: Don't fan-out to followers if user is shadowbanned
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (user?.isShadowBanned) {
        return;
    }

    const { cacheDel, cacheLPush, cacheLTrim, getRedis } = await import('../lib/redis');
    const redisClient = getRedis();

    const cursor = db.collection('follows').find({
        following_id: new ObjectId(userId),
        status: 'active', // Standard status for feeds
        // status: 'accepted' - REMOVED: Status must match models/follow.ts ('active')
    });

    let batchCount = 0;
    let pipeline = (redisClient as any).pipeline ? (redisClient as any).pipeline() : null;

    while (await cursor.hasNext()) {
        const follow = await cursor.next();
        if (!follow) continue;

        const followerId = follow.follower_id.toString();

        if (type === 'new_post' && postId) {
            const listKey = `feed:${followerId}:list`;
            if (pipeline) {
                pipeline.lpush(listKey, postId.toString());
                pipeline.ltrim(listKey, 0, 499);
                pipeline.del(`feed:${followerId}`);
                batchCount++;
            } else {
                await cacheLPush(listKey, postId.toString());
                await cacheLTrim(listKey, 0, 499);
                await cacheDel(`feed:${followerId}`);
            }
        } else if (type === 'new_reel' && reelId) {
            const listKey = `reels:feed:${followerId}:list`;
            if (pipeline) {
                pipeline.lpush(listKey, reelId.toString());
                pipeline.ltrim(listKey, 0, 199);
                pipeline.del(`reels:feed:${followerId}`);
                batchCount++;
            } else {
                await cacheLPush(listKey, reelId.toString());
                await cacheLTrim(listKey, 0, 199);
                await cacheDel(`reels:feed:${followerId}`);
            }
        }

        // Execute every 50 followers
        if (pipeline && batchCount >= 50) {
            await pipeline.exec();
            pipeline = (redisClient as any).pipeline();
            batchCount = 0;
        }
    }

    if (pipeline && batchCount > 0) {
        await pipeline.exec();
    }
}, workerSettings) : null;



// Error handling for workers
if (notificationWorker) {
    notificationWorker.on('failed', (job, err) => {
        logger.error(`Notification Job ${job?.id} failed:`, err);
    });
}

if (feedUpdateWorker) {
    feedUpdateWorker.on('failed', (job, err) => {
        logger.error(`Feed Update Job ${job?.id} failed:`, err);
    });
}

logger.info('🚀 Background Workers Started Successfully');
