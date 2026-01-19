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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from api-server directory
const envPath = path_1.default.resolve(process.cwd(), '.env');
const result = dotenv_1.default.config({ path: envPath });
// Manually set MONGODB_URI from parsed result if dotenv didn't set it correctly
if (((_a = result.parsed) === null || _a === void 0 ? void 0 : _a.MONGODB_URI) && !((_b = process.env.MONGODB_URI) === null || _b === void 0 ? void 0 : _b.includes('mongodb+srv'))) {
    process.env.MONGODB_URI = result.parsed.MONGODB_URI;
}
const express_1 = __importDefault(require("express"));
require("express-async-errors");
const logger_1 = require("./middleware/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const mongoose_1 = __importDefault(require("mongoose"));
const websocket_1 = require("./lib/websocket");
const redis_1 = require("./lib/redis");
const performance_monitor_1 = require("./lib/performance-monitor");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const posts_1 = __importDefault(require("./routes/posts"));
const reels_1 = __importDefault(require("./routes/reels"));
const stories_1 = __importDefault(require("./routes/stories"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const chat_1 = __importDefault(require("./routes/chat"));
const upload_1 = __importDefault(require("./routes/upload"));
const feed_1 = __importDefault(require("./routes/feed"));
const explore_1 = __importDefault(require("./routes/explore"));
const hashtags_1 = __importDefault(require("./routes/hashtags"));
const reports_1 = __importDefault(require("./routes/reports"));
const search_1 = __importDefault(require("./routes/search"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const bookmarks_1 = __importDefault(require("./routes/bookmarks"));
const comments_1 = __importDefault(require("./routes/comments"));
const settings_1 = __importDefault(require("./routes/settings"));
const push_1 = __importDefault(require("./routes/push"));
const professional_1 = __importDefault(require("./routes/professional"));
const verification_1 = __importDefault(require("./routes/verification"));
const close_friends_1 = __importDefault(require("./routes/close-friends"));
const highlights_1 = __importDefault(require("./routes/highlights"));
const stories_close_friends_1 = __importDefault(require("./routes/stories-close-friends"));
const notes_1 = __importDefault(require("./routes/notes"));
const crush_list_1 = __importDefault(require("./routes/crush-list"));
const secret_crush_1 = __importDefault(require("./routes/secret-crush"));
const premium_1 = __importDefault(require("./routes/premium"));
const demo_1 = __importDefault(require("./routes/demo"));
const ai_1 = __importDefault(require("./routes/ai"));
const express_prom_bundle_1 = __importDefault(require("express-prom-bundle"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const firebase_messaging_1 = require("./services/firebase-messaging");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = parseInt(process.env.PORT || '8000');
// Initialize Firebase for push notifications
(0, firebase_messaging_1.initializeFirebase)();
(0, redis_1.initRedis)();
let redisHealthy = false;
let redisLastCheck = 0;
const REDIS_CHECK_INTERVAL = 5000;
const REDIS_CHECK_TIMEOUT = 150;
const redisClient = (0, redis_1.getRedis)();
const checkRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!redisClient || typeof redisClient.ping !== 'function') {
        redisHealthy = false;
        redisLastCheck = Date.now();
        return;
    }
    try {
        const pingPromise = redisClient.ping();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), REDIS_CHECK_TIMEOUT));
        const result = yield Promise.race([pingPromise, timeoutPromise]);
        redisHealthy = result !== 'timeout';
    }
    catch (_a) {
        redisHealthy = false;
    }
    finally {
        redisLastCheck = Date.now();
    }
});
checkRedis();
setInterval(checkRedis, REDIS_CHECK_INTERVAL).unref();
// Initialize WebSocket server
const io = (0, websocket_1.initializeWebSocket)(httpServer);
console.log('✅ WebSocket server initialized');
// Connect to MongoDB at startup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
mongoose_1.default.set('strictQuery', false);
mongoose_1.default.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
})
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log('✅ MongoDB connected successfully');
    try {
        const db = mongoose_1.default.connection.db;
        if (db) {
            yield db.collection('users').createIndex({ email: 1 }, { unique: true });
            yield db.collection('users').createIndex({ username: 1 }, { unique: true });
            yield db.collection('users').createIndex({ created_at: -1 });
            yield db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });
            yield db.collection('notifications').createIndex({ userId: 1, isRead: 1, createdAt: -1 });
            yield db.collection('follows').createIndex({ followerId: 1 });
            yield db.collection('follows').createIndex({ followingId: 1 });
            console.log('✅ Database indexes created');
        }
    }
    catch (error) {
        console.log('⚠️  Index creation skipped (may already exist)');
    }
}))
    .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Server will continue but database operations may fail');
});
// Security Middleware
const security_1 = require("./middleware/security");
// Middleware
app.use(security_1.securityHeaders); // Helmet security headers
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for mobile app compatibility
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Timestamp', 'X-Signature']
}));
// Security layers
app.use(security_1.xssProtection);
app.use(security_1.ipFilter);
app.use(security_1.detectSuspiciousActivity);
app.use(security_1.sanitizeInput);
// Global rate limiting:
// - Production: 100 req/min (per IP)
// - Non‑production (local/testing): very high limit to avoid 429 during load tests
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    app.use((0, security_1.rateLimiter)(100, 60000));
}
else {
    app.use((0, security_1.rateLimiter)(100000, 60000));
}
app.use(security_1.validateRequestSignature);
app.use(security_1.csrfProtection);
app.use(security_1.secureSession);
// Prometheus Metrics Middleware
const metricsMiddleware = (0, express_prom_bundle_1.default)({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    includeUp: true,
    customLabels: { project_name: 'anufy_api' },
    promClient: {
        collectDefaultMetrics: {}
    }
});
app.use(metricsMiddleware);
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
app.use(logger_1.httpLogger);
app.use(logger_1.requestId);
// Performance Monitoring Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const userId = req.userId;
        (0, performance_monitor_1.recordMetric)(req.path, req.method, duration, res.statusCode, userId);
    });
    next();
});
// Swagger Documentation
const swaggerPath = path_1.default.resolve(process.cwd(), 'src', 'docs', 'swagger.yaml');
const swaggerDocument = yamljs_1.default.load(swaggerPath);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
// Serve static files (for password reset redirect page)
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const dbStatus = mongoose_1.default.connection.readyState === 1;
    const redisStatus = redisHealthy;
    const status = dbStatus && redisStatus ? 'ok' : 'degraded';
    res.status(status === 'ok' ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus ? 'connected' : 'disconnected',
            redis: redisStatus ? 'connected' : 'disconnected'
        }
    });
}));
// Password reset redirect page
app.get('/reset-password', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'reset-redirect.html'));
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/posts', posts_1.default);
app.use('/api/reels', reels_1.default);
app.use('/api/stories', stories_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/feed', feed_1.default);
app.use('/api/explore', explore_1.default);
app.use('/api/hashtags', hashtags_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/search', search_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/bookmarks', bookmarks_1.default);
app.use('/api/comments', comments_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/push', push_1.default);
app.use('/api/close-friends', close_friends_1.default);
app.use('/api/highlights', highlights_1.default);
app.use('/api/stories', stories_close_friends_1.default);
app.use('/api/notes', notes_1.default);
app.use('/api/crush-list', crush_list_1.default);
app.use('/api/secret-crush', secret_crush_1.default);
app.use('/api/premium', premium_1.default);
app.use('/api/demo', demo_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/professional', professional_1.default);
app.use('/api/verification', verification_1.default);
// Performance Metrics Endpoint (Admin only)
app.get('/api/metrics', (_req, res) => {
    res.json({
        summary: (0, performance_monitor_1.getPerformanceSummary)(),
        violations: (0, performance_monitor_1.checkPerformanceTargets)()
    });
});
// Global Error Handler (must be last)
app.use(errorHandler_1.errorHandler);
// Start server with WebSocket support
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Anufy API Server running on port ${PORT}`);
    console.log(`🔌 WebSocket server ready for real-time chat`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Network access: http://10.55.239.5:${PORT}/health`);
    console.log(`📍 Auth routes: http://localhost:${PORT}/api/auth/*`);
    console.log(`📍 User routes: http://localhost:${PORT}/api/users/*`);
    console.log(`📍 Post routes: http://localhost:${PORT}/api/posts/*`);
    console.log(`📍 Reel routes: http://localhost:${PORT}/api/reels/*`);
    console.log(`📍 Story routes: http://localhost:${PORT}/api/stories/*`);
    console.log(`📍 Notification routes: http://localhost:${PORT}/api/notifications/*`);
    console.log(`📍 Chat routes: http://localhost:${PORT}/api/chat/*`);
    console.log(`📍 Upload routes: http://localhost:${PORT}/api/upload/*`);
    console.log(`📍 Feed routes: http://localhost:${PORT}/api/feed/*`);
    console.log(`📍 Explore routes: http://localhost:${PORT}/api/explore/*`);
    console.log(`📍 Reports routes: http://localhost:${PORT}/api/reports/*`);
    console.log(`📍 Search routes: http://localhost:${PORT}/api/search/*`);
    console.log(`📍 Analytics routes: http://localhost:${PORT}/api/analytics/*`);
    console.log(`📍 Bookmarks routes: http://localhost:${PORT}/api/bookmarks/*`);
    // Keep service awake on Render free tier (prevents sleeping after 15 min)
    if (process.env.NODE_ENV === 'production') {
        const BACKEND_URL = 'https://aufybackend.onrender.com';
        logger_1.logger.info('🔄 Self-ping enabled - keeping service awake');
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const response = yield fetch(`${BACKEND_URL}/health`);
                if (response.ok) {
                    logger_1.logger.info('✅ Self-ping successful');
                }
                else {
                    logger_1.logger.warn('⚠️  Self-ping returned:', response.status);
                }
            }
            catch (error) {
                logger_1.logger.warn('⚠️  Self-ping failed:', error.message);
            }
        }), 10 * 60 * 1000); // Ping every 10 minutes
    }
});
// Graceful Shutdown
const shutdown = (signal) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.logger.info(`收到 ${signal}。正在优雅关闭...`);
    // Close HTTP server
    httpServer.close(() => {
        logger_1.logger.info('HTTP 服务器已关闭。');
    });
    // Close MongoDB connection
    try {
        yield mongoose_1.default.connection.close();
        logger_1.logger.info('MongoDB 连接已关闭。');
    }
    catch (err) {
        logger_1.logger.error('关闭 MongoDB 时出错:', err);
    }
    // Final exit
    setTimeout(() => {
        logger_1.logger.info('进程退出。');
        process.exit(0);
    }, 1000);
});
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
exports.default = app;
