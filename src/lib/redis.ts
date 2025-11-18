import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Fallback to local Redis if Upstash is not configured
const localRedis = process.env.REDIS_URL ? new Redis({
  url: process.env.REDIS_URL,
}) : null;

const client = redis || localRedis;

export class CacheService {
  private static instance: CacheService;
  private redis: Redis;

  private constructor() {
    this.redis = client!;
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // Session management
  async setSession(sessionId: string, userId: string, expiresIn: number = 3600): Promise<void> {
    try {
      await this.redis.setex(`session:${sessionId}`, expiresIn, userId);
    } catch (error) {
      console.error('Redis session set error:', error);
    }
  }

  async getSession(sessionId: string): Promise<string | null> {
    try {
      return await this.redis.get(`session:${sessionId}`);
    } catch (error) {
      console.error('Redis session get error:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`session:${sessionId}`);
    } catch (error) {
      console.error('Redis session delete error:', error);
    }
  }

  // Feed caching
  async setFeed(userId: string, feed: any[], expiresIn: number = 300): Promise<void> {
    try {
      await this.redis.setex(`feed:${userId}`, expiresIn, JSON.stringify(feed));
    } catch (error) {
      console.error('Redis feed set error:', error);
    }
  }

  async getFeed(userId: string): Promise<any[] | null> {
    try {
      const feed = await this.redis.get(`feed:${userId}`);
      return feed ? JSON.parse(feed) : null;
    } catch (error) {
      console.error('Redis feed get error:', error);
      return null;
    }
  }

  async invalidateFeed(userId: string): Promise<void> {
    try {
      await this.redis.del(`feed:${userId}`);
    } catch (error) {
      console.error('Redis feed invalidate error:', error);
    }
  }

  // Profile visitor counts
  async incrementVisitorCount(profileId: string): Promise<number> {
    try {
      return await this.redis.incr(`visitors:${profileId}`);
    } catch (error) {
      console.error('Redis visitor count increment error:', error);
      return 0;
    }
  }

  async getVisitorCount(profileId: string): Promise<number> {
    try {
      const count = await this.redis.get(`visitors:${profileId}`);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Redis visitor count get error:', error);
      return 0;
    }
  }

  async setVisitorCount(profileId: string, count: number): Promise<void> {
    try {
      await this.redis.set(`visitors:${profileId}`, count);
    } catch (error) {
      console.error('Redis visitor count set error:', error);
    }
  }

  // Post likes/comments caching
  async setPostStats(postId: string, stats: { likes: number; comments: number }): Promise<void> {
    try {
      await this.redis.setex(`post:${postId}:stats`, 1800, JSON.stringify(stats));
    } catch (error) {
      console.error('Redis post stats set error:', error);
    }
  }

  async getPostStats(postId: string): Promise<{ likes: number; comments: number } | null> {
    try {
      const stats = await this.redis.get(`post:${postId}:stats`);
      return stats ? JSON.parse(stats) : null;
    } catch (error) {
      console.error('Redis post stats get error:', error);
      return null;
    }
  }

  async incrementPostLikes(postId: string): Promise<number> {
    try {
      return await this.redis.incr(`post:${postId}:likes`);
    } catch (error) {
      console.error('Redis post likes increment error:', error);
      return 0;
    }
  }

  async decrementPostLikes(postId: string): Promise<number> {
    try {
      return await this.redis.decr(`post:${postId}:likes`);
    } catch (error) {
      console.error('Redis post likes decrement error:', error);
      return 0;
    }
  }

  // User online status
  async setUserOnline(userId: string, expiresIn: number = 300): Promise<void> {
    try {
      await this.redis.setex(`online:${userId}`, expiresIn, 'true');
    } catch (error) {
      console.error('Redis user online set error:', error);
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const status = await this.redis.get(`online:${userId}`);
      return status === 'true';
    } catch (error) {
      console.error('Redis user online get error:', error);
      return false;
    }
  }

  async setUserOffline(userId: string): Promise<void> {
    try {
      await this.redis.del(`online:${userId}`);
    } catch (error) {
      console.error('Redis user offline set error:', error);
    }
  }

  // Generic cache methods
  async set(key: string, value: any, expiresIn?: number): Promise<void> {
    try {
      if (expiresIn) {
        await this.redis.setex(key, expiresIn, JSON.stringify(value));
      } else {
        await this.redis.set(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async get(key: string): Promise<any> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  // Cache warming for popular content
  async warmCache(): Promise<void> {
    try {
      // This would be called periodically to pre-populate cache with popular content
      console.log('Cache warming initiated...');
      // Implementation would depend on specific caching strategy
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }
}

export const cacheService = CacheService.getInstance();
export default cacheService;
