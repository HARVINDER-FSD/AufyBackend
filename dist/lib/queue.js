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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.addJob = exports.isQueueAvailable = exports.tasksQueue = exports.analyticsQueue = exports.feedUpdateQueue = exports.notificationQueue = exports.QUEUE_NAMES = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("../middleware/logger");
const ioredis_1 = __importDefault(require("ioredis"));
// Redis connection configuration for BullMQ
// Note: BullMQ requires a real Redis connection (TCP/TLS), not HTTP/REST.
let connection = null;
let redisAvailable = false;
try {
    connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        retryStrategy: (times) => {
            if (times > 3) {
                logger_1.logger.warn('⚠️  Queue Redis connection failed after 3 retries, queues disabled');
                redisAvailable = false;
                return null;
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        tls: ((_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.startsWith('rediss://')) ? {} : undefined,
        lazyConnect: true,
    });
    connection.on('connect', () => {
        logger_1.logger.info('✅ Queue Redis connected');
        redisAvailable = true;
    });
    connection.on('error', (err) => {
        logger_1.logger.warn('⚠️  Queue Redis Connection Error:', err.message);
        redisAvailable = false;
    });
    // Try to connect but don't block
    connection.connect().catch(() => {
        logger_1.logger.warn('⚠️  Queue Redis unavailable, queues will be disabled');
        redisAvailable = false;
    });
}
catch (error) {
    logger_1.logger.warn('⚠️  Failed to initialize Queue Redis:', error);
    connection = null;
    redisAvailable = false;
}
// Define Queue Names
exports.QUEUE_NAMES = {
    NOTIFICATIONS: 'notifications-queue',
    FEED_UPDATES: 'feed-updates-queue',
    ANALYTICS: 'analytics-queue',
    TASKS: 'tasks-queue',
};
// Initialize Queues (only if Redis is available)
exports.notificationQueue = connection ? new bullmq_1.Queue(exports.QUEUE_NAMES.NOTIFICATIONS, { connection }) : null;
exports.feedUpdateQueue = connection ? new bullmq_1.Queue(exports.QUEUE_NAMES.FEED_UPDATES, { connection }) : null;
exports.analyticsQueue = connection ? new bullmq_1.Queue(exports.QUEUE_NAMES.ANALYTICS, { connection }) : null;
exports.tasksQueue = connection ? new bullmq_1.Queue(exports.QUEUE_NAMES.TASKS, { connection }) : null;
const isQueueAvailable = () => redisAvailable && connection !== null;
exports.isQueueAvailable = isQueueAvailable;
// Helper to add jobs
const addJob = (queueName_1, jobName_1, data_1, ...args_1) => __awaiter(void 0, [queueName_1, jobName_1, data_1, ...args_1], void 0, function* (queueName, jobName, data, options = {}) {
    try {
        if (!redisAvailable || !connection) {
            logger_1.logger.warn(`⚠️  Queue unavailable, skipping job: ${queueName}/${jobName}`);
            return null;
        }
        let queue;
        switch (queueName) {
            case exports.QUEUE_NAMES.NOTIFICATIONS:
                queue = exports.notificationQueue;
                break;
            case exports.QUEUE_NAMES.FEED_UPDATES:
                queue = exports.feedUpdateQueue;
                break;
            case exports.QUEUE_NAMES.ANALYTICS:
                queue = exports.analyticsQueue;
                break;
            case exports.QUEUE_NAMES.TASKS:
                queue = exports.tasksQueue;
                break;
            default:
                throw new Error(`Unknown queue name: ${queueName}`);
        }
        if (!queue) {
            logger_1.logger.warn(`⚠️  Queue not initialized: ${queueName}`);
            return null;
        }
        const job = yield queue.add(jobName, data, Object.assign({ attempts: 3, backoff: {
                type: 'exponential',
                delay: 1000,
            }, removeOnComplete: true }, options));
        logger_1.logger.debug(`Job added to ${queueName}: ${job.id}`);
        return job;
    }
    catch (error) {
        logger_1.logger.warn(`Failed to add job to ${queueName}:`, error);
        // Don't throw - allow app to continue without queues
        return null;
    }
});
exports.addJob = addJob;
