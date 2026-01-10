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
exports.cache = exports.redis = exports.cacheTTL = exports.cacheKeys = void 0;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDelete = cacheDelete;
exports.cacheDeletePattern = cacheDeletePattern;
exports.cacheWithTTL = cacheWithTTL;
const ioredis_1 = __importDefault(require("ioredis"));
// Initialize Redis connection (will use Upstash when configured)
const redis = process.env.REDIS_URL
    ? new ioredis_1.default(process.env.REDIS_URL)
    : null;
exports.redis = redis;
// Cache wrapper with fallback
function cacheGet(key) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redis)
            return null;
        try {
            const cached = yield redis.get(key);
            return cached ? JSON.parse(cached) : null;
        }
        catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    });
}
function cacheSet(key, value, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redis)
            return;
        try {
            yield redis.setex(key, ttlSeconds, JSON.stringify(value));
        }
        catch (error) {
            console.error('Cache set error:', error);
        }
    });
}
function cacheDelete(key) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redis)
            return;
        try {
            yield redis.del(key);
        }
        catch (error) {
            console.error('Cache delete error:', error);
        }
    });
}
function cacheDeletePattern(pattern) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redis)
            return;
        try {
            const keys = yield redis.keys(pattern);
            if (keys.length > 0) {
                yield redis.del(...keys);
            }
        }
        catch (error) {
            console.error('Cache delete pattern error:', error);
        }
    });
}
// Cache key generators
exports.cacheKeys = {
    user: (userId) => `user:${userId}`,
    userByUsername: (username) => `user:username:${username}`,
    post: (postId) => `post:${postId}`,
    feed: (userId, page = 1) => `feed:${userId}:${page}`,
    followers: (userId) => `followers:${userId}`,
    following: (userId) => `following:${userId}`,
    stories: (userId) => `stories:${userId}`,
    userPosts: (userId, page = 1) => `posts:${userId}:${page}`,
};
// Cache TTL (Time To Live) in seconds
exports.cacheTTL = {
    user: 900, // 15 minutes
    post: 600, // 10 minutes
    feed: 300, // 5 minutes
    followers: 600, // 10 minutes
    following: 600, // 10 minutes
    stories: 180, // 3 minutes
    userPosts: 600, // 10 minutes
};
// Helper function to cache with automatic TTL
function cacheWithTTL(key, ttl, fetchFn) {
    return __awaiter(this, void 0, void 0, function* () {
        // Try cache first
        const cached = yield cacheGet(key);
        if (cached !== null) {
            return cached;
        }
        // Cache miss - fetch data
        const data = yield fetchFn();
        // Cache the result
        yield cacheSet(key, data, ttl);
        return data;
    });
}
exports.cache = {
    get: cacheGet,
    set: cacheSet,
    del: cacheDelete,
    deletePattern: cacheDeletePattern,
    clear: () => __awaiter(void 0, void 0, void 0, function* () {
        if (!redis)
            return;
        try {
            yield redis.flushdb();
        }
        catch (error) {
            console.error('Cache clear error:', error);
        }
    })
};
