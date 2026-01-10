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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const redis_1 = require("@upstash/redis");
const ioredis_1 = __importDefault(require("ioredis"));
// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL ? new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : null;
// Fallback to local Redis if Upstash is not configured
const localRedis = process.env.REDIS_URL ? new ioredis_1.default(process.env.REDIS_URL) : null;
const client = redis || localRedis;
class CacheService {
    constructor() {
        this.redis = client;
    }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    // Session management
    setSession(sessionId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, userId, expiresIn = 3600) {
            try {
                yield this.redis.setex(`session:${sessionId}`, expiresIn, userId);
            }
            catch (error) {
                console.error('Redis session set error:', error);
            }
        });
    }
    getSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.redis.get(`session:${sessionId}`);
            }
            catch (error) {
                console.error('Redis session get error:', error);
                return null;
            }
        });
    }
    deleteSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.del(`session:${sessionId}`);
            }
            catch (error) {
                console.error('Redis session delete error:', error);
            }
        });
    }
    // Feed caching
    setFeed(userId_1, feed_1) {
        return __awaiter(this, arguments, void 0, function* (userId, feed, expiresIn = 300) {
            try {
                yield this.redis.setex(`feed:${userId}`, expiresIn, JSON.stringify(feed));
            }
            catch (error) {
                console.error('Redis feed set error:', error);
            }
        });
    }
    getFeed(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const feed = yield this.redis.get(`feed:${userId}`);
                return feed ? JSON.parse(feed) : null;
            }
            catch (error) {
                console.error('Redis feed get error:', error);
                return null;
            }
        });
    }
    invalidateFeed(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.del(`feed:${userId}`);
            }
            catch (error) {
                console.error('Redis feed invalidate error:', error);
            }
        });
    }
    // Profile visitor counts
    incrementVisitorCount(profileId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.redis.incr(`visitors:${profileId}`);
            }
            catch (error) {
                console.error('Redis visitor count increment error:', error);
                return 0;
            }
        });
    }
    getVisitorCount(profileId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield this.redis.get(`visitors:${profileId}`);
                return count ? parseInt(count) : 0;
            }
            catch (error) {
                console.error('Redis visitor count get error:', error);
                return 0;
            }
        });
    }
    setVisitorCount(profileId, count) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.set(`visitors:${profileId}`, count);
            }
            catch (error) {
                console.error('Redis visitor count set error:', error);
            }
        });
    }
    // Post likes/comments caching
    setPostStats(postId, stats) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.setex(`post:${postId}:stats`, 1800, JSON.stringify(stats));
            }
            catch (error) {
                console.error('Redis post stats set error:', error);
            }
        });
    }
    getPostStats(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield this.redis.get(`post:${postId}:stats`);
                return stats ? JSON.parse(stats) : null;
            }
            catch (error) {
                console.error('Redis post stats get error:', error);
                return null;
            }
        });
    }
    incrementPostLikes(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.redis.incr(`post:${postId}:likes`);
            }
            catch (error) {
                console.error('Redis post likes increment error:', error);
                return 0;
            }
        });
    }
    decrementPostLikes(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.redis.decr(`post:${postId}:likes`);
            }
            catch (error) {
                console.error('Redis post likes decrement error:', error);
                return 0;
            }
        });
    }
    // User online status
    setUserOnline(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, expiresIn = 300) {
            try {
                yield this.redis.setex(`online:${userId}`, expiresIn, 'true');
            }
            catch (error) {
                console.error('Redis user online set error:', error);
            }
        });
    }
    isUserOnline(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const status = yield this.redis.get(`online:${userId}`);
                return status === 'true';
            }
            catch (error) {
                console.error('Redis user online get error:', error);
                return false;
            }
        });
    }
    setUserOffline(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.del(`online:${userId}`);
            }
            catch (error) {
                console.error('Redis user offline set error:', error);
            }
        });
    }
    // Generic cache methods
    set(key, value, expiresIn) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (expiresIn) {
                    yield this.redis.setex(key, expiresIn, JSON.stringify(value));
                }
                else {
                    yield this.redis.set(key, JSON.stringify(value));
                }
            }
            catch (error) {
                console.error('Redis set error:', error);
            }
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const value = yield this.redis.get(key);
                return value ? JSON.parse(value) : null;
            }
            catch (error) {
                console.error('Redis get error:', error);
                return null;
            }
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.del(key);
            }
            catch (error) {
                console.error('Redis delete error:', error);
            }
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.redis.exists(key);
                return result === 1;
            }
            catch (error) {
                console.error('Redis exists error:', error);
                return false;
            }
        });
    }
    // Cache warming for popular content
    warmCache() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would be called periodically to pre-populate cache with popular content
                console.log('Cache warming initiated...');
                // Implementation would depend on specific caching strategy
            }
            catch (error) {
                console.error('Cache warming error:', error);
            }
        });
    }
}
exports.CacheService = CacheService;
exports.cacheService = CacheService.getInstance();
exports.default = exports.cacheService;
