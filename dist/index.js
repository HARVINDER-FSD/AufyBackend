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
// Load environment variables FIRST before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// When running with tsx, __dirname is api-server/src, so go up one level to api-server
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
console.log('Loaded .env from:', path_1.default.resolve(__dirname, '..', '.env'));
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI value:', (_a = process.env.MONGODB_URI) === null || _a === void 0 ? void 0 : _a.substring(0, 50));
const express_1 = __importDefault(require("express"));
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
const settings_1 = __importDefault(require("./routes/settings"));
const push_1 = __importDefault(require("./routes/push"));
const close_friends_1 = __importDefault(require("./routes/close-friends"));
const highlights_1 = __importDefault(require("./routes/highlights"));
const stories_close_friends_1 = __importDefault(require("./routes/stories-close-friends"));
const notes_1 = __importDefault(require("./routes/notes"));
const crush_list_1 = __importDefault(require("./routes/crush-list"));
const secret_crush_1 = __importDefault(require("./routes/secret-crush"));
const premium_1 = __importDefault(require("./routes/premium"));
const demo_1 = __importDefault(require("./routes/demo"));
const ai_1 = __importDefault(require("./routes/ai"));
const firebase_messaging_1 = require("./services/firebase-messaging");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = parseInt(process.env.PORT || '8000');
// Initialize Firebase for push notifications
(0, firebase_messaging_1.initializeFirebase)();
// Initialize Redis for caching
(0, redis_1.initRedis)();
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
    // Create indexes for faster queries
    try {
        const db = mongoose_1.default.connection.db;
        if (db) {
            yield db.collection('users').createIndex({ email: 1 }, { unique: true });
            yield db.collection('users').createIndex({ username: 1 }, { unique: true });
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
app.use((0, security_1.rateLimiter)(100, 60000)); // 100 requests per minute
app.use(security_1.validateRequestSignature);
app.use(security_1.csrfProtection);
app.use(security_1.secureSession);
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
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
// Serve static files (for password reset redirect page)
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Anufy API Server is running' });
});
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
// Performance Metrics Endpoint (Admin only)
app.get('/api/metrics', (_req, res) => {
    res.json({
        summary: (0, performance_monitor_1.getPerformanceSummary)(),
        violations: (0, performance_monitor_1.checkPerformanceTargets)()
    });
});
// Error handling
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});
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
        console.log('🔄 Self-ping enabled - keeping service awake');
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const response = yield fetch(`${BACKEND_URL}/health`);
                if (response.ok) {
                    console.log('✅ Self-ping successful');
                }
                else {
                    console.log('⚠️  Self-ping returned:', response.status);
                }
            }
            catch (error) {
                console.log('⚠️  Self-ping failed:', error.message);
            }
        }), 10 * 60 * 1000); // Ping every 10 minutes
    }
});
exports.default = app;
