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
exports.addJob = exports.tasksQueue = exports.analyticsQueue = exports.feedUpdateQueue = exports.notificationQueue = exports.QUEUE_NAMES = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("../middleware/logger");
const ioredis_1 = __importDefault(require("ioredis"));
// Redis connection configuration for BullMQ
// Note: BullMQ requires a real Redis connection (TCP/TLS), not HTTP/REST.
const connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
    tls: ((_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.startsWith('rediss://')) ? {} : undefined,
});
connection.on('error', (err) => {
    logger_1.logger.error('Queue Redis Connection Error:', err);
});
// Define Queue Names
exports.QUEUE_NAMES = {
    NOTIFICATIONS: 'notifications-queue',
    FEED_UPDATES: 'feed-updates-queue',
    ANALYTICS: 'analytics-queue',
    TASKS: 'tasks-queue',
};
// Initialize Queues
exports.notificationQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.NOTIFICATIONS, { connection });
exports.feedUpdateQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.FEED_UPDATES, { connection });
exports.analyticsQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.ANALYTICS, { connection });
exports.tasksQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.TASKS, { connection });
// Helper to add jobs
const addJob = (queueName_1, jobName_1, data_1, ...args_1) => __awaiter(void 0, [queueName_1, jobName_1, data_1, ...args_1], void 0, function* (queueName, jobName, data, options = {}) {
    try {
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
        const job = yield queue.add(jobName, data, Object.assign({ attempts: 3, backoff: {
                type: 'exponential',
                delay: 1000,
            }, removeOnComplete: true }, options));
        logger_1.logger.debug(`Job added to ${queueName}: ${job.id}`);
        return job;
    }
    catch (error) {
        logger_1.logger.error(`Failed to add job to ${queueName}:`, error);
        throw error;
    }
});
exports.addJob = addJob;
