import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from '../middleware/logger';
import Redis from 'ioredis';

// Redis connection configuration for BullMQ
// Note: BullMQ requires a real Redis connection (TCP/TLS), not HTTP/REST.
let connection: Redis | null = null;
let redisAvailable = false;

try {
  connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('⚠️  Queue Redis connection failed after 3 retries, queues disabled');
        redisAvailable = false;
        return null;
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
  });

  connection.on('connect', () => {
    logger.info('✅ Queue Redis connected');
    redisAvailable = true;
  });

  connection.on('error', (err) => {
    logger.warn('⚠️  Queue Redis Connection Error:', err.message);
    redisAvailable = false;
  });

  // Try to connect but don't block
  connection.connect().catch(() => {
    logger.warn('⚠️  Queue Redis unavailable, queues will be disabled');
    redisAvailable = false;
  });
} catch (error) {
  logger.warn('⚠️  Failed to initialize Queue Redis:', error);
  connection = null;
  redisAvailable = false;
}

// Define Queue Names
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications-queue',
  FEED_UPDATES: 'feed-updates-queue',
  ANALYTICS: 'analytics-queue',
  TASKS: 'tasks-queue',
};

// Initialize Queues (only if Redis is available)
export const notificationQueue = connection ? new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection }) : null;
export const feedUpdateQueue = connection ? new Queue(QUEUE_NAMES.FEED_UPDATES, { connection }) : null;
export const analyticsQueue = connection ? new Queue(QUEUE_NAMES.ANALYTICS, { connection }) : null;
export const tasksQueue = connection ? new Queue(QUEUE_NAMES.TASKS, { connection }) : null;

export const isQueueAvailable = () => redisAvailable && connection !== null;


// Helper to add jobs
export const addJob = async (queueName: string, jobName: string, data: any, options = {}) => {
  try {
    if (!redisAvailable || !connection) {
      logger.warn(`⚠️  Queue unavailable, skipping job: ${queueName}/${jobName}`);
      return null;
    }

    let queue;
    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATIONS:
        queue = notificationQueue;
        break;
      case QUEUE_NAMES.FEED_UPDATES:
        queue = feedUpdateQueue;
        break;
      case QUEUE_NAMES.ANALYTICS:
        queue = analyticsQueue;
        break;
      case QUEUE_NAMES.TASKS:
        queue = tasksQueue;
        break;
      default:
        throw new Error(`Unknown queue name: ${queueName}`);
    }

    if (!queue) {
      logger.warn(`⚠️  Queue not initialized: ${queueName}`);
      return null;
    }

    const job = await queue.add(jobName, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      ...options,
    });

    logger.debug(`Job added to ${queueName}: ${job.id}`);
    return job;
  } catch (error) {
    logger.warn(`Failed to add job to ${queueName}:`, error);
    // Don't throw - allow app to continue without queues
    return null;
  }
};
