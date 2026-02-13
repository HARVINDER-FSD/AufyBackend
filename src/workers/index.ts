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

try {
  connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('⚠️  Workers Redis connection failed, workers disabled');
        return null;
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
  });

  connection.on('connect', () => {
    logger.info('✅ Workers Redis connected');
    workersInitialized = true;
  });

  connection.on('error', (err) => {
    logger.warn('⚠️  Workers Redis error:', err.message);
  });

  connection.connect().catch(() => {
    logger.warn('⚠️  Workers Redis unavailable');
  });
} catch (error) {
  logger.warn('⚠️  Failed to initialize Workers Redis:', error);
  connection = null;
}

// Initialize specialized workers
setupLikeWorker(connection);
setupChatWorker(connection);

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
}, { connection }) : null;

// 2. Feed Update Worker (Invalidates cache for followers)
const feedUpdateWorker = connection ? new Worker(QUEUE_NAMES.FEED_UPDATES, async (job: Job) => {
    const { userId, type, postId, reelId } = job.data;
    const db = await getDatabase();
    const { cacheInvalidate, cacheLPush, cacheLTrim } = await import('../lib/redis');

    if (type === 'new_post') {
        // Use cursor for memory efficiency with large follower counts
        const cursor = db.collection('follows').find({
            following_id: new ObjectId(userId),
            status: 'accepted'
        });

        // Process in batches to prevent blocking event loop too long
        while (await cursor.hasNext()) {
            const follow = await cursor.next();
            if (!follow) continue;
            
            const followerId = follow.follower_id.toString();
            
            // 1. Fan-out: Push to Redis List
            if (postId) {
                await cacheLPush(`feed:${followerId}:list`, postId.toString());
                // Keep only latest 500 posts in the feed list to save memory
                await cacheLTrim(`feed:${followerId}:list`, 0, 499);
            }

            // 2. Invalidate API Cache (Page Cache)
            await cacheInvalidate(`feed:${followerId}:*`);
        }
    } else if (type === 'new_reel') {
        const cursor = db.collection('follows').find({
            following_id: new ObjectId(userId),
            status: 'accepted'
        });

        while (await cursor.hasNext()) {
            const follow = await cursor.next();
            if (!follow) continue;

            const followerId = follow.follower_id.toString();
            
            // Fan-out: Push to Redis List
            if (reelId) {
                await cacheLPush(`reels:feed:${followerId}:list`, reelId.toString());
                // Keep only latest 200 reels in the feed list
                await cacheLTrim(`reels:feed:${followerId}:list`, 0, 199);
            }
        }
    }
}, { connection }) : null;



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
