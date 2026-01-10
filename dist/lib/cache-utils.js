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
    static getFeed(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.getFeed(userId);
        });
    }
    static setFeed(userId, feed) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.setFeed(userId, feed, exports.CacheTTL.FEED);
        });
    }
    static invalidateFeed(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.invalidateFeed(userId);
        });
    }
    static invalidateAllFeeds() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would need to be implemented with a pattern-based deletion
            // For now, we'll invalidate specific user feeds as needed
            console.log('Invalidating all feeds...');
        });
    }
}
exports.FeedCache = FeedCache;
// Post stats caching utilities
class PostStatsCache {
    static getStats(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.getPostStats(postId);
        });
    }
    static setStats(postId, stats) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.setPostStats(postId, stats);
        });
    }
    static incrementLikes(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.incrementPostLikes(postId);
        });
    }
    static decrementLikes(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.decrementPostLikes(postId);
        });
    }
}
exports.PostStatsCache = PostStatsCache;
// User online status utilities
class UserStatusCache {
    static setOnline(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.setUserOnline(userId, exports.CacheTTL.USER_ONLINE);
        });
    }
    static setOffline(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.setUserOffline(userId);
        });
    }
    static isOnline(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.isUserOnline(userId);
        });
    }
}
exports.UserStatusCache = UserStatusCache;
// Visitor count utilities
class VisitorCache {
    static getCount(profileId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.getVisitorCount(profileId);
        });
    }
    static incrementCount(profileId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.incrementVisitorCount(profileId);
        });
    }
    static setCount(profileId, count) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.setVisitorCount(profileId, count);
        });
    }
}
exports.VisitorCache = VisitorCache;
// Session management utilities
class SessionCache {
    static setSession(sessionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.setSession(sessionId, userId, exports.CacheTTL.SESSION);
        });
    }
    static getSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield redis_1.cacheService.getSession(sessionId);
        });
    }
    static deleteSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redis_1.cacheService.deleteSession(sessionId);
        });
    }
}
exports.SessionCache = SessionCache;
// Cache invalidation strategies
class CacheInvalidation {
    static onPostCreate(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Invalidate user's feed and their followers' feeds
            yield FeedCache.invalidateFeed(userId);
            // TODO: Invalidate followers' feeds
        });
    }
    static onPostLike(postId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Invalidate post stats cache
            yield redis_1.cacheService.del(exports.CacheKeys.postStats(postId));
            // Invalidate user's feed if they have it cached
            yield FeedCache.invalidateFeed(userId);
        });
    }
    static onPostComment(postId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Invalidate post stats cache
            yield redis_1.cacheService.del(exports.CacheKeys.postStats(postId));
            // Invalidate user's feed if they have it cached
            yield FeedCache.invalidateFeed(userId);
        });
    }
    static onUserFollow(followerId, followingId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Invalidate both users' feeds
            yield FeedCache.invalidateFeed(followerId);
            yield FeedCache.invalidateFeed(followingId);
        });
    }
    static onProfileUpdate(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Invalidate user profile cache
            yield redis_1.cacheService.del(exports.CacheKeys.userProfile(userId));
            // Invalidate user's feed
            yield FeedCache.invalidateFeed(userId);
        });
    }
}
exports.CacheInvalidation = CacheInvalidation;
// Cache warming utilities
class CacheWarming {
    static warmPopularContent() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Warm cache with popular posts, trending hashtags, etc.
                console.log('Warming popular content cache...');
                // Implementation would depend on specific requirements
            }
            catch (error) {
                console.error('Error warming popular content cache:', error);
            }
        });
    }
    static warmUserFeeds(userIds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Pre-populate feeds for active users
                console.log(`Warming feeds for ${userIds.length} users...`);
                // Implementation would depend on specific requirements
            }
            catch (error) {
                console.error('Error warming user feeds:', error);
            }
        });
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
