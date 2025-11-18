import { cacheService } from './redis';

// Cache key generators
export const CacheKeys = {
  session: (sessionId: string) => `session:${sessionId}`,
  feed: (userId: string) => `feed:${userId}`,
  postStats: (postId: string) => `post:${postId}:stats`,
  postLikes: (postId: string) => `post:${postId}:likes`,
  postComments: (postId: string) => `post:${postId}:comments`,
  userOnline: (userId: string) => `online:${userId}`,
  visitorCount: (profileId: string) => `visitors:${profileId}`,
  userProfile: (userId: string) => `profile:${userId}`,
  storyStats: (storyId: string) => `story:${storyId}:stats`,
  reelStats: (reelId: string) => `reel:${reelId}:stats`,
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
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
export class FeedCache {
  static async getFeed(userId: string): Promise<any[] | null> {
    return await cacheService.getFeed(userId);
  }

  static async setFeed(userId: string, feed: any[]): Promise<void> {
    await cacheService.setFeed(userId, feed, CacheTTL.FEED);
  }

  static async invalidateFeed(userId: string): Promise<void> {
    await cacheService.invalidateFeed(userId);
  }

  static async invalidateAllFeeds(): Promise<void> {
    // This would need to be implemented with a pattern-based deletion
    // For now, we'll invalidate specific user feeds as needed
    console.log('Invalidating all feeds...');
  }
}

// Post stats caching utilities
export class PostStatsCache {
  static async getStats(postId: string): Promise<{ likes: number; comments: number } | null> {
    return await cacheService.getPostStats(postId);
  }

  static async setStats(postId: string, stats: { likes: number; comments: number }): Promise<void> {
    await cacheService.setPostStats(postId, stats);
  }

  static async incrementLikes(postId: string): Promise<number> {
    return await cacheService.incrementPostLikes(postId);
  }

  static async decrementLikes(postId: string): Promise<number> {
    return await cacheService.decrementPostLikes(postId);
  }
}

// User online status utilities
export class UserStatusCache {
  static async setOnline(userId: string): Promise<void> {
    await cacheService.setUserOnline(userId, CacheTTL.USER_ONLINE);
  }

  static async setOffline(userId: string): Promise<void> {
    await cacheService.setUserOffline(userId);
  }

  static async isOnline(userId: string): Promise<boolean> {
    return await cacheService.isUserOnline(userId);
  }
}

// Visitor count utilities
export class VisitorCache {
  static async getCount(profileId: string): Promise<number> {
    return await cacheService.getVisitorCount(profileId);
  }

  static async incrementCount(profileId: string): Promise<number> {
    return await cacheService.incrementVisitorCount(profileId);
  }

  static async setCount(profileId: string, count: number): Promise<void> {
    await cacheService.setVisitorCount(profileId, count);
  }
}

// Session management utilities
export class SessionCache {
  static async setSession(sessionId: string, userId: string): Promise<void> {
    await cacheService.setSession(sessionId, userId, CacheTTL.SESSION);
  }

  static async getSession(sessionId: string): Promise<string | null> {
    return await cacheService.getSession(sessionId);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await cacheService.deleteSession(sessionId);
  }
}

// Cache invalidation strategies
export class CacheInvalidation {
  static async onPostCreate(userId: string): Promise<void> {
    // Invalidate user's feed and their followers' feeds
    await FeedCache.invalidateFeed(userId);
    // TODO: Invalidate followers' feeds
  }

  static async onPostLike(postId: string, userId: string): Promise<void> {
    // Invalidate post stats cache
    await cacheService.del(CacheKeys.postStats(postId));
    // Invalidate user's feed if they have it cached
    await FeedCache.invalidateFeed(userId);
  }

  static async onPostComment(postId: string, userId: string): Promise<void> {
    // Invalidate post stats cache
    await cacheService.del(CacheKeys.postStats(postId));
    // Invalidate user's feed if they have it cached
    await FeedCache.invalidateFeed(userId);
  }

  static async onUserFollow(followerId: string, followingId: string): Promise<void> {
    // Invalidate both users' feeds
    await FeedCache.invalidateFeed(followerId);
    await FeedCache.invalidateFeed(followingId);
  }

  static async onProfileUpdate(userId: string): Promise<void> {
    // Invalidate user profile cache
    await cacheService.del(CacheKeys.userProfile(userId));
    // Invalidate user's feed
    await FeedCache.invalidateFeed(userId);
  }
}

// Cache warming utilities
export class CacheWarming {
  static async warmPopularContent(): Promise<void> {
    try {
      // Warm cache with popular posts, trending hashtags, etc.
      console.log('Warming popular content cache...');
      // Implementation would depend on specific requirements
    } catch (error) {
      console.error('Error warming popular content cache:', error);
    }
  }

  static async warmUserFeeds(userIds: string[]): Promise<void> {
    try {
      // Pre-populate feeds for active users
      console.log(`Warming feeds for ${userIds.length} users...`);
      // Implementation would depend on specific requirements
    } catch (error) {
      console.error('Error warming user feeds:', error);
    }
  }
}

export default {
  CacheKeys,
  CacheTTL,
  FeedCache,
  PostStatsCache,
  UserStatusCache,
  VisitorCache,
  SessionCache,
  CacheInvalidation,
  CacheWarming,
};
