"use strict";
/**
 * Simple In-Memory Cache
 * For production, replace with Redis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = exports.CacheKeys = exports.cache = void 0;
class MemoryCache {
    constructor() {
        this.cache = new Map();
        // Clean up expired items every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }
    /**
     * Get item from cache
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }
    /**
     * Set item in cache with TTL (time to live) in seconds
     */
    set(key, data, ttlSeconds = 300) {
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { data, expiry });
    }
    /**
     * Delete item from cache
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Delete all items matching pattern
     */
    deletePattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache stats
     */
    stats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
    /**
     * Clean up expired items
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Destroy cache and cleanup
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}
// Export singleton instance
exports.cache = new MemoryCache();
// Cache key generators
exports.CacheKeys = {
    userProfile: (userId) => `user:profile:${userId}`,
    userFeed: (userId, page) => `user:feed:${userId}:${page}`,
    posts: (page) => `posts:${page}`,
    reels: (page) => `reels:${page}`,
    stories: () => `stories:all`,
    userStories: (userId) => `stories:user:${userId}`,
    trending: (category) => `trending:${category}`,
    search: (query) => `search:${query}`,
    followers: (userId) => `followers:${userId}`,
    following: (userId) => `following:${userId}`,
};
// Cache TTL (time to live) in seconds
exports.CacheTTL = {
    short: 60, // 1 minute
    medium: 300, // 5 minutes
    long: 900, // 15 minutes
    veryLong: 3600, // 1 hour
};
