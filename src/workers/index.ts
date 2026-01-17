import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES } from '../lib/queue';
import { logger } from '../middleware/logger';
import { Expo } from 'expo-server-sdk';
import { getDatabase } from '../lib/database';
import { ObjectId } from 'mongodb';

const expo = new Expo();

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
});

// 1. Notification Worker
const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATIONS, async (job: Job) => {
    const { recipientId, title, body, data } = job.data;

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
            await expo.sendPushNotificationsAsync(chunk);
        }
        logger.info(`Successfully sent push notification to ${recipientId}`);
    } catch (error) {
        logger.error(`Error sending push notification to ${recipientId}:`, error);
    }
}, { connection });

// 2. Feed Update Worker (Invalidates cache for followers)
const feedUpdateWorker = new Worker(QUEUE_NAMES.FEED_UPDATES, async (job: Job) => {
    const { userId, type } = job.data;
    const db = await getDatabase();
    const { cacheInvalidate } = await import('../lib/redis');

    if (type === 'new_post') {
        // When someone posts, we might want to invalidate their followers' feeds
        const followers = await db.collection('follows').find({
            following_id: new ObjectId(userId),
            status: 'accepted'
        }).toArray();

        for (const follow of followers) {
            const followerId = follow.follower_id.toString();
            await cacheInvalidate(`feed:${followerId}:*`);
        }
        logger.info(`Invalidated feeds for ${followers.length} followers of ${userId}`);
    }
}, { connection });

// Error handling for workers
notificationWorker.on('failed', (job, err) => {
    logger.error(`Notification Job ${job?.id} failed:`, err);
});

feedUpdateWorker.on('failed', (job, err) => {
    logger.error(`Feed Update Job ${job?.id} failed:`, err);
});

logger.info('🚀 Background Workers Started Successfully');
