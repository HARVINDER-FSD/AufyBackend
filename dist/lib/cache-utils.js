"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheWarming = exports.CacheInvalidation = exports.SessionCache = exports.VisitorCache = exports.UserStatusCache = exports.PostStatsCache = exports.FeedCache = exports.CacheTTL = exports.CacheKeys = void 0;
const redis_1 = require("./redis");
// Cache key generators
exports.CacheKeys = {
    session: (sessionId) => `session:${sessionId}`,
    feed: (userId) => `feed:${userId}`,
    postStats: (postId) => `post:${postId}:stats`,
    postLikes: (postId) => `post:${postId}:likes`,
    postComments: (postId) => `post:${postId}:comments`,
    userOnline: (userId) => `online:${userId}`,
    visitorCount: (profileId) => `visitors:${profileId}`,
    userProfile: (userId) => `profile:${userId}`,
    storyStats: (storyId) => `story:${storyId}:stats`,
    reelStats: (reelId) => `reel:${reelId}:stats`,
};
// Cache TTL constants (in seconds)
exports.CacheTTL = {
    SESSION: 3600, // 1 hour
    FEED: 300, // 5 minutes
    POST_STATS: 1800, // 30 minutes
    USER_ONLINE: 300, // 5 minutes
    VISITOR_COUNT: 86400, // 24 hours
    USER_PROFILE: 1800, // 30 minutes
    STORY_STATS: 1800, // 30 minutes
    REEL_STATS: 1800, // 30 minutes
};
// Feed caching utilities
class FeedCache {
    static async getFeed(userId) {
        return await redis_1.cacheService.getFeed(userId);
    }
    static async setFeed(userId, feed) {
        await redis_1.cacheService.setFeed(userId, feed, exports.CacheTTL.FEED);
    }
    static async invalidateFeed(userId) {
        await redis_1.cacheService.invalidateFeed(userId);
    }
    static async invalidateAllFeeds() {
        // This would need to be implemented with a pattern-based deletion
        // For now, we'll invalidate specific user feeds as needed
        console.log('Invalidating all feeds...');
    }
}
exports.FeedCache = FeedCache;
// Post stats caching utilities
class PostStatsCache {
    static async getStats(postId) {
        return await redis_1.cacheService.getPostStats(postId);
    }
    static async setStats(postId, stats) {
        await redis_1.cacheService.setPostStats(postId, stats);
    }
    static async incrementLikes(postId) {
        return await redis_1.cacheService.incrementPostLikes(postId);
    }
    static async decrementLikes(postId) {
        return await redis_1.cacheService.decrementPostLikes(postId);
    }
}
exports.PostStatsCache = PostStatsCache;
// User online status utilities
class UserStatusCache {
    static async setOnline(userId) {
        await redis_1.cacheService.setUserOnline(userId, exports.CacheTTL.USER_ONLINE);
    }
    static async setOffline(userId) {
        await redis_1.cacheService.setUserOffline(userId);
    }
    static async isOnline(userId) {
        return await redis_1.cacheService.isUserOnline(userId);
    }
}
exports.UserStatusCache = UserStatusCache;
// Visitor count utilities
class VisitorCache {
    static async getCount(profileId) {
        return await redis_1.cacheService.getVisitorCount(profileId);
    }
    static async incrementCount(profileId) {
        return await redis_1.cacheService.incrementVisitorCount(profileId);
    }
    static async setCount(profileId, count) {
        await redis_1.cacheService.setVisitorCount(profileId, count);
    }
}
exports.VisitorCache = VisitorCache;
// Session management utilities
class SessionCache {
    static async setSession(sessionId, userId) {
        await redis_1.cacheService.setSession(sessionId, userId, exports.CacheTTL.SESSION);
    }
    static async getSession(sessionId) {
        return await redis_1.cacheService.getSession(sessionId);
    }
    static async deleteSession(sessionId) {
        await redis_1.cacheService.deleteSession(sessionId);
    }
}
exports.SessionCache = SessionCache;
// Cache invalidation strategies
class CacheInvalidation {
    static async onPostCreate(userId) {
        // Invalidate user's feed and their followers' feeds
        await FeedCache.invalidateFeed(userId);
        // TODO: Invalidate followers' feeds
    }
    static async onPostLike(postId, userId) {
        // Invalidate post stats cache
        await redis_1.cacheService.del(exports.CacheKeys.postStats(postId));
        // Invalidate user's feed if they have it cached
        await FeedCache.invalidateFeed(userId);
    }
    static async onPostComment(postId, userId) {
        // Invalidate post stats cache
        await redis_1.cacheService.del(exports.CacheKeys.postStats(postId));
        // Invalidate user's feed if they have it cached
        await FeedCache.invalidateFeed(userId);
    }
    static async onUserFollow(followerId, followingId) {
        // Invalidate both users' feeds
        await FeedCache.invalidateFeed(followerId);
        await FeedCache.invalidateFeed(followingId);
    }
    static async onProfileUpdate(userId) {
        // Invalidate user profile cache
        await redis_1.cacheService.del(exports.CacheKeys.userProfile(userId));
        // Invalidate user's feed
        await FeedCache.invalidateFeed(userId);
    }
}
exports.CacheInvalidation = CacheInvalidation;
// Cache warming utilities
class CacheWarming {
    static async warmPopularContent() {
        try {
            // Warm cache with popular posts, trending hashtags, etc.
            console.log('Warming popular content cache...');
            // Implementation would depend on specific requirements
        }
        catch (error) {
            console.error('Error warming popular content cache:', error);
        }
    }
    static async warmUserFeeds(userIds) {
        try {
            // Pre-populate feeds for active users
            console.log(`Warming feeds for ${userIds.length} users...`);
            // Implementation would depend on specific requirements
        }
        catch (error) {
            console.error('Error warming user feeds:', error);
        }
    }
}
exports.CacheWarming = CacheWarming;
exports.default = {
    CacheKeys: exports.CacheKeys,
    CacheTTL: exports.CacheTTL,
    FeedCache,
    PostStatsCache,
    UserStatusCache,
    VisitorCache,
    SessionCache,
    CacheInvalidation,
    CacheWarming,
};
