import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from '../middleware/logger';
import Redis from 'ioredis';

// Redis connection configuration for BullMQ
// Note: BullMQ requires a real Redis connection (TCP/TLS), not HTTP/REST.
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  connectTimeout: 10000,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
});

connection.on('error', (err) => {
  logger.error('Queue Redis Connection Error:', err);
});

// Define Queue Names
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications-queue',
  FEED_UPDATES: 'feed-updates-queue',
  ANALYTICS: 'analytics-queue',
  TASKS: 'tasks-queue',
};

// Initialize Queues
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection });
export const feedUpdateQueue = new Queue(QUEUE_NAMES.FEED_UPDATES, { connection });
export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, { connection });
export const tasksQueue = new Queue(QUEUE_NAMES.TASKS, { connection });


// Helper to add jobs
export const addJob = async (queueName: string, jobName: string, data: any, options = {}) => {
  try {
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
    logger.error(`Failed to add job to ${queueName}:`, error);
    throw error;
  }
};
