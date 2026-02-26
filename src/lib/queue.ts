import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from '../middleware/logger';
import Redis from 'ioredis';

// Redis connection configuration for BullMQ
// Note: BullMQ requires a real Redis connection (TCP/TLS), not HTTP/REST.
let connection: Redis | null = null;
let redisAvailable = false;

// Redis explicitly disabled by user
logger.info('🛡️  Offline Mode: Queue Redis explicitly disabled by user, queues disabled');
connection = null;
redisAvailable = false;

/*
try {
  connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    ...
*/

// Define Queue Names
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications-queue',
  FEED_UPDATES: 'feed-updates-queue',
  ANALYTICS: 'analytics-queue',
  TASKS: 'tasks-queue',
  LIKES: 'likes-queue', // Added for async likes
  MESSAGES: 'messages-queue', // Added for async chat messages
};

// Initialize Queues (only if Redis is available)
export const notificationQueue = connection ? new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection }) : null;
export const feedUpdateQueue = connection ? new Queue(QUEUE_NAMES.FEED_UPDATES, { connection }) : null;
export const analyticsQueue = connection ? new Queue(QUEUE_NAMES.ANALYTICS, { connection }) : null;
export const tasksQueue = connection ? new Queue(QUEUE_NAMES.TASKS, { connection }) : null;
export const likesQueue = connection ? new Queue(QUEUE_NAMES.LIKES, { connection }) : null;
export const messagesQueue = connection ? new Queue(QUEUE_NAMES.MESSAGES, { connection }) : null;

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
      case QUEUE_NAMES.LIKES:
        queue = likesQueue;
        break;
      case QUEUE_NAMES.MESSAGES:
        queue = messagesQueue;
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
