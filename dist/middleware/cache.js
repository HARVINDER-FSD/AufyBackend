"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheMiddleware = cacheMiddleware;
exports.invalidateCache = invalidateCache;
exports.clearAllCache = clearAllCache;
const cache_1 = require("../lib/cache");
/**
 * Cache middleware for GET requests
 * Usage: router.get('/path', cacheMiddleware(300), handler)
 */
function cacheMiddleware(ttlSeconds = 300) {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }
        // Generate cache key from URL and query params
        const cacheKey = `route:${req.originalUrl}`;
        // Try to get from cache
        const cachedData = cache_1.cache.get(cacheKey);
        if (cachedData) {
            console.log(`✅ Cache HIT: ${cacheKey}`);
            return res.json(cachedData);
        }
        console.log(`❌ Cache MISS: ${cacheKey}`);
        // Store original json method
        const originalJson = res.json.bind(res);
        // Override json method to cache response
        res.json = function (data) {
            // Cache the response
            cache_1.cache.set(cacheKey, data, ttlSeconds);
            // Call original json method
            return originalJson(data);
        };
        next();
    };
}
/**
 * Invalidate cache for specific patterns
 */
function invalidateCache(pattern) {
    cache_1.cache.deletePattern(pattern);
    console.log(`🗑️  Cache invalidated: ${pattern}`);
}
/**
 * Clear all cache
 */
function clearAllCache() {
    cache_1.cache.clear();
    console.log('🗑️  All cache cleared');
}
