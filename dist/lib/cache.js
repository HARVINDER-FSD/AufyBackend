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
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.cacheTTL = exports.cacheKeys = exports.cache = void 0;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDelete = cacheDelete;
exports.cacheDeletePattern = cacheDeletePattern;
exports.cacheWithTTL = cacheWithTTL;
const redis_1 = require("./redis");
/**
 * Legacy cache wrapper that uses the unified Redis instance.
 * This provides backward compatibility for files importing from lib/cache.
 */
exports.cache = redis_1.cacheService;
function cacheGet(key) {
    return __awaiter(this, void 0, void 0, function* () {
        return redis_1.cacheService.get(key);
    });
}
function cacheSet(key, value, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redis_1.cacheService.set(key, value, ttlSeconds);
    });
}
function cacheDelete(key) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redis_1.cacheService.del(key);
    });
}
function cacheDeletePattern(pattern) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redis_1.cacheService.invalidate(pattern);
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
// Export redis instance for advanced usage
exports.redis = (0, redis_1.getRedis)();
