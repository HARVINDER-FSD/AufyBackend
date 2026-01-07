"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// When running with tsx, __dirname is api-server/src, so go up one level to api-server
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
console.log('Loaded .env from:', path_1.default.resolve(__dirname, '..', '.env'));
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI value:', process.env.MONGODB_URI?.substring(0, 50));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const mongoose_1 = __importDefault(require("mongoose"));
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
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '8000');
// Connect to MongoDB at startup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
mongoose_1.default.set('strictQuery', false);
mongoose_1.default.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
})
    .then(async () => {
    console.log('✅ MongoDB connected successfully');
    // Create indexes for faster queries
    try {
        const db = mongoose_1.default.connection.db;
        if (db) {
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            await db.collection('users').createIndex({ username: 1 }, { unique: true });
            console.log('✅ Database indexes created');
        }
    }
    catch (error) {
        console.log('⚠️  Index creation skipped (may already exist)');
    }
})
    .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Server will continue but database operations may fail');
});
// Middleware
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for now, restrict in production
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Anufy API Server is running' });
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
// Error handling
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});
// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`� Aenufy API Server running on port ${PORT}`);
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
});
exports.default = app;
