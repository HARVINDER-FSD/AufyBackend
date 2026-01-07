"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundWorkers = exports.queue = void 0;
const mongodb_1 = require("mongodb");
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
// Simple in-memory queue for background tasks
class BackgroundQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.workers = new Map();
        this.startWorker();
    }
    static getInstance() {
        if (!BackgroundQueue.instance) {
            BackgroundQueue.instance = new BackgroundQueue();
        }
        return BackgroundQueue.instance;
    }
    // Register a worker for a specific task type
    registerWorker(taskType, worker) {
        this.workers.set(taskType, worker);
    }
    // Add a task to the queue
    async enqueue(taskType, data, priority = 1) {
        const taskId = `${taskType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task = {
            id: taskId,
            task: taskType,
            data,
            priority,
            createdAt: new Date()
        };
        this.queue.push(task);
        this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
        console.log(`Task ${taskId} enqueued: ${taskType}`);
        return taskId;
    }
    // Start the background worker
    startWorker() {
        if (this.processing)
            return;
        this.processing = true;
        this.processQueue();
    }
    // Process the queue
    async processQueue() {
        while (this.processing) {
            if (this.queue.length > 0) {
                const task = this.queue.shift();
                if (task) {
                    await this.processTask(task);
                }
            }
            else {
                // Wait 1 second before checking again
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    // Process a single task
    async processTask(task) {
        try {
            const worker = this.workers.get(task.task);
            if (worker) {
                console.log(`Processing task ${task.id}: ${task.task}`);
                await worker(task.data);
                console.log(`Task ${task.id} completed successfully`);
            }
            else {
                console.error(`No worker found for task type: ${task.task}`);
            }
        }
        catch (error) {
            console.error(`Error processing task ${task.id}:`, error);
            // Optionally retry failed tasks
            if (task.priority > 0) {
                task.priority--; // Reduce priority for retry
                this.queue.push(task);
                this.queue.sort((a, b) => b.priority - a.priority);
            }
        }
    }
    // Stop the worker
    stop() {
        this.processing = false;
    }
    // Get queue status
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            registeredWorkers: Array.from(this.workers.keys())
        };
    }
}
// Background task workers
class BackgroundWorkers {
    // Send notification email
    static async sendNotificationEmail(data) {
        try {
            console.log(`Sending notification email to user ${data.userId}: ${data.type}`);
            // Here you would integrate with an email service like SendGrid, AWS SES, etc.
            // For now, we'll just log it
            console.log(`Email notification: ${data.message}`);
        }
        catch (error) {
            console.error('Error sending notification email:', error);
            throw error;
        }
    }
    // Process image/video upload
    static async processMediaUpload(data) {
        try {
            console.log(`Processing media upload: ${data.mediaId}`);
            // Here you would integrate with image processing services
            // Generate thumbnails, optimize images, etc.
            console.log(`Media processed: ${data.url}`);
        }
        catch (error) {
            console.error('Error processing media upload:', error);
            throw error;
        }
    }
    // Update user statistics
    static async updateUserStats(data) {
        try {
            console.log(`Updating user stats for ${data.userId}`);
            const client = await mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            await db.collection('user_stats').updateOne({ user_id: new mongodb_1.ObjectId(data.userId) }, { $set: { ...data.stats, updated_at: new Date() } }, { upsert: true });
            await client.close();
            console.log(`User stats updated for ${data.userId}`);
        }
        catch (error) {
            console.error('Error updating user stats:', error);
            throw error;
        }
    }
    // Clean up expired data
    static async cleanupExpiredData(data) {
        try {
            console.log(`Cleaning up expired ${data.type} data`);
            const client = await mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            let result;
            switch (data.type) {
                case 'stories':
                    result = await db.collection('stories').deleteMany({
                        expires_at: { $lt: data.olderThan }
                    });
                    break;
                case 'sessions':
                    result = await db.collection('sessions').deleteMany({
                        expires_at: { $lt: data.olderThan }
                    });
                    break;
                case 'temp_files':
                    result = await db.collection('temp_files').deleteMany({
                        created_at: { $lt: data.olderThan }
                    });
                    break;
                default:
                    console.log(`Unknown cleanup type: ${data.type}`);
                    return;
            }
            await client.close();
            console.log(`Cleaned up ${result.deletedCount} expired ${data.type} records`);
        }
        catch (error) {
            console.error('Error cleaning up expired data:', error);
            throw error;
        }
    }
    // Generate analytics report
    static async generateAnalyticsReport(data) {
        try {
            console.log(`Generating analytics report for user ${data.userId}, period: ${data.period}`);
            const client = await mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            // Generate various analytics
            const postsCount = await db.collection('posts').countDocuments({
                user_id: new mongodb_1.ObjectId(data.userId)
            });
            const likesCount = await db.collection('likes').countDocuments({
                user_id: new mongodb_1.ObjectId(data.userId)
            });
            const followersCount = await db.collection('follows').countDocuments({
                following_id: new mongodb_1.ObjectId(data.userId)
            });
            const report = {
                user_id: data.userId,
                period: data.period,
                posts_count: postsCount,
                likes_received: likesCount,
                followers_count: followersCount,
                generated_at: new Date()
            };
            await db.collection('analytics_reports').insertOne(report);
            await client.close();
            console.log(`Analytics report generated for user ${data.userId}`);
        }
        catch (error) {
            console.error('Error generating analytics report:', error);
            throw error;
        }
    }
    // Backup user data
    static async backupUserData(data) {
        try {
            console.log(`Creating backup for user ${data.userId}, type: ${data.backupType}`);
            const client = await mongodb_1.MongoClient.connect(MONGODB_URI);
            const db = client.db();
            // Collect user data
            const user = await db.collection('users').findOne({
                _id: new mongodb_1.ObjectId(data.userId)
            });
            const posts = await db.collection('posts').find({
                user_id: new mongodb_1.ObjectId(data.userId)
            }).toArray();
            const backup = {
                user_id: data.userId,
                backup_type: data.backupType,
                user_data: user,
                posts_data: posts,
                created_at: new Date()
            };
            await db.collection('user_backups').insertOne(backup);
            await client.close();
            console.log(`Backup created for user ${data.userId}`);
        }
        catch (error) {
            console.error('Error creating user backup:', error);
            throw error;
        }
    }
}
exports.BackgroundWorkers = BackgroundWorkers;
// Initialize the queue and register workers
const queue = BackgroundQueue.getInstance();
exports.queue = queue;
// Register all workers
queue.registerWorker('send_notification_email', BackgroundWorkers.sendNotificationEmail);
queue.registerWorker('process_media_upload', BackgroundWorkers.processMediaUpload);
queue.registerWorker('update_user_stats', BackgroundWorkers.updateUserStats);
queue.registerWorker('cleanup_expired_data', BackgroundWorkers.cleanupExpiredData);
queue.registerWorker('generate_analytics_report', BackgroundWorkers.generateAnalyticsReport);
queue.registerWorker('backup_user_data', BackgroundWorkers.backupUserData);
exports.default = queue;
