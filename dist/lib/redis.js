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
exports.redis = exports.cacheService = exports.cacheInvalidate = exports.cacheDel = exports.cacheSet = exports.cacheGet = exports.getRedis = exports.initRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redis_1 = require("@upstash/redis");
let redis = null;
exports.redis = redis;
const initRedis = () => {
    if (redis)
        return redis;
    try {
        // Check if using Upstash Redis (REST API)
        const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
        const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        // Prefer Upstash HTTP client if REST credentials are provided
        if (upstashUrl && upstashToken) {
            console.log('🔗 Connecting to Upstash Redis (HTTP)');
            exports.redis = redis = new redis_1.Redis({
                url: upstashUrl,
                token: upstashToken,
            });
            return redis;
        }
        else {
            // Fallback to local Redis or standard TCP Redis
            console.log('🔗 Connecting to local/TCP Redis');
            const client = new ioredis_1.default({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                retryStrategy: (times) => {
                    if (times > 3) {
                        console.warn('⚠️  Redis connection failed, continuing without cache');
                        return null;
                    }
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: null,
                connectTimeout: 5000,
                lazyConnect: true
            });
            client.on('connect', () => {
                console.log('✅ Redis connected successfully');
            });
            client.on('error', (err) => {
                console.warn('⚠️  Redis error (continuing without cache):', err.message);
            });
            // Try to connect but don't block if it fails
            client.connect().catch(() => {
                console.warn('⚠️  Redis unavailable, app will work without caching');
            });
            exports.redis = redis = client;
            return redis;
        }
    }
    catch (error) {
        console.warn('⚠️  Failed to initialize Redis:', error);
        return null;
    }
};
exports.initRedis = initRedis;
const getRedis = () => {
    if (!redis) {
        return (0, exports.initRedis)();
    }
    return redis;
};
exports.getRedis = getRedis;
// Cache helpers
const cacheGet = (key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return null;
        const data = yield redis.get(key);
        // Upstash might return object if it was stored as JSON? No, we stringify.
        // ioredis returns string or null. Upstash returns string or null or number etc.
        // We assume string for JSON.parse
        return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
    }
    catch (error) {
        console.error('Cache get error:', error);
        return null;
    }
});
exports.cacheGet = cacheGet;
const cacheSet = (key_1, value_1, ...args_1) => __awaiter(void 0, [key_1, value_1, ...args_1], void 0, function* (key, value, ttl = 3600) {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return false;
        const stringValue = JSON.stringify(value);
        if (redis instanceof ioredis_1.default) {
            yield redis.setex(key, ttl, stringValue);
        }
        else {
            // Upstash Redis
            yield redis.set(key, stringValue, { ex: ttl });
        }
        return true;
    }
    catch (error) {
        console.error('Cache set error:', error);
        return false;
    }
});
exports.cacheSet = cacheSet;
const cacheDel = (key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return false;
        yield redis.del(key);
        return true;
    }
    catch (error) {
        console.error('Cache delete error:', error);
        return false;
    }
});
exports.cacheDel = cacheDel;
const cacheInvalidate = (pattern) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return false;
        if (redis instanceof ioredis_1.default) {
            const keys = yield redis.keys(pattern);
            if (keys.length > 0) {
                yield redis.del(...keys);
            }
        }
        else {
            // Upstash Redis (REST) doesn't support keys() well in some versions or it's risky.
            // For now, we log it. In a real app we'd use a better strategy.
            console.warn('⚠️ Pattern invalidation not fully supported on Upstash REST');
        }
        return true;
    }
    catch (error) {
        console.error('Cache invalidate error:', error);
        return false;
    }
});
exports.cacheInvalidate = cacheInvalidate;
// Unified Cache Service to replace scattered implementations
exports.cacheService = {
    get: exports.cacheGet,
    set: exports.cacheSet,
    del: exports.cacheDel,
    invalidate: exports.cacheInvalidate,
    deletePattern: exports.cacheInvalidate,
    clear: () => __awaiter(void 0, void 0, void 0, function* () {
        const redis = (0, exports.getRedis)();
        if (redis instanceof ioredis_1.default)
            yield redis.flushdb();
        else
            console.warn('⚠️ Clear (flushdb) not supported on Upstash REST');
    }),
    // Specific helpers for cache-utils.ts mapping
    getFeed: (userId) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheGet)(`feed:${userId}`); }),
    setFeed: (userId, data, ttl) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheSet)(`feed:${userId}`, data, ttl); }),
    invalidateFeed: (userId) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheDel)(`feed:${userId}`); }),
    getPostStats: (postId) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheGet)(`post:${postId}:stats`); }),
    setPostStats: (postId, stats) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheSet)(`post:${postId}:stats`, stats); }),
    getUserOnline: (userId) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheGet)(`online:${userId}`); }),
    setUserOnline: (userId, ttl) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheSet)(`online:${userId}`, true, ttl); }),
    setUserOffline: (userId) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheDel)(`online:${userId}`); }),
    isUserOnline: (userId) => __awaiter(void 0, void 0, void 0, function* () { return !!(yield (0, exports.cacheGet)(`online:${userId}`)); }),
    getSession: (sid) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheGet)(`session:${sid}`); }),
    setSession: (sid, uid, ttl) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheSet)(`session:${sid}`, uid, ttl); }),
    deleteSession: (sid) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheDel)(`session:${sid}`); }),
    incrementPostLikes: (postId) => __awaiter(void 0, void 0, void 0, function* () {
        const redis = (0, exports.getRedis)();
        if (redis instanceof ioredis_1.default)
            return yield redis.incr(`post:${postId}:likes`);
        return yield redis.incr(`post:${postId}:likes`);
    }),
    decrementPostLikes: (postId) => __awaiter(void 0, void 0, void 0, function* () {
        const redis = (0, exports.getRedis)();
        if (redis instanceof ioredis_1.default)
            return yield redis.decr(`post:${postId}:likes`);
        return yield redis.decr(`post:${postId}:likes`);
    }),
    getVisitorCount: (id) => __awaiter(void 0, void 0, void 0, function* () { return (yield (0, exports.cacheGet)(`visitors:${id}`)) || 0; }),
    incrementVisitorCount: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const redis = (0, exports.getRedis)();
        if (redis instanceof ioredis_1.default)
            return yield redis.incr(`visitors:${id}`);
        return yield redis.incr(`visitors:${id}`);
    }),
    setVisitorCount: (id, count) => __awaiter(void 0, void 0, void 0, function* () { return (0, exports.cacheSet)(`visitors:${id}`, count); }),
};
