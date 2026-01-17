import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';

let redis: Redis | UpstashRedis | null = null;

export const initRedis = () => {
  if (redis) return redis;

  try {
    // Check if using Upstash Redis (REST API)
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // Prefer Upstash HTTP client if REST credentials are provided
    if (upstashUrl && upstashToken) {
      console.log('🔗 Connecting to Upstash Redis (HTTP)');
      redis = new UpstashRedis({
        url: upstashUrl,
        token: upstashToken,
      });
      return redis;
    } else {
      // Fallback to local Redis or standard TCP Redis
      console.log('🔗 Connecting to local/TCP Redis');

      const client = new Redis({
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

      redis = client;
      return redis;
    }
  } catch (error) {
    console.warn('⚠️  Failed to initialize Redis:', error);
    return null;
  }
};

export const getRedis = () => {
  if (!redis) {
    return initRedis();
  }
  return redis;
};

// Cache helpers
export const cacheGet = async (key: string) => {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const data = await redis.get(key);
    // Upstash might return object if it was stored as JSON? No, we stringify.
    // ioredis returns string or null. Upstash returns string or null or number etc.
    // We assume string for JSON.parse
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, value: any, ttl: number = 3600) => {
  try {
    const redis = getRedis();
    if (!redis) return false;

    const stringValue = JSON.stringify(value);

    if (redis instanceof Redis) {
      await redis.setex(key, ttl, stringValue);
    } else {
      // Upstash Redis
      await redis.set(key, stringValue, { ex: ttl });
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

export const cacheDel = async (key: string) => {
  try {
    const redis = getRedis();
    if (!redis) return false;
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
};

export const cacheInvalidate = async (pattern: string) => {
  try {
    const redis = getRedis();
    if (!redis) return false;

    if (redis instanceof Redis) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Upstash Redis (REST) doesn't support keys() well in some versions or it's risky.
      // For now, we log it. In a real app we'd use a better strategy.
      console.warn('⚠️ Pattern invalidation not fully supported on Upstash REST');
    }
    return true;
  } catch (error) {
    console.error('Cache invalidate error:', error);
    return false;
  }
};

// Unified Cache Service to replace scattered implementations
export const cacheService = {
  get: cacheGet,
  set: cacheSet,
  del: cacheDel,
  invalidate: cacheInvalidate,
  deletePattern: cacheInvalidate,
  clear: async () => {
    const redis = getRedis();
    if (redis instanceof Redis) await redis.flushdb();
    else console.warn('⚠️ Clear (flushdb) not supported on Upstash REST');
  },

  // Specific helpers for cache-utils.ts mapping
  getFeed: async (userId: string) => cacheGet(`feed:${userId}`),
  setFeed: async (userId: string, data: any, ttl: number) => cacheSet(`feed:${userId}`, data, ttl),
  invalidateFeed: async (userId: string) => cacheDel(`feed:${userId}`),

  getPostStats: async (postId: string) => cacheGet(`post:${postId}:stats`),
  setPostStats: async (postId: string, stats: any) => cacheSet(`post:${postId}:stats`, stats),

  getUserOnline: async (userId: string) => cacheGet(`online:${userId}`),
  setUserOnline: async (userId: string, ttl: number) => cacheSet(`online:${userId}`, true, ttl),
  setUserOffline: async (userId: string) => cacheDel(`online:${userId}`),
  isUserOnline: async (userId: string) => !!(await cacheGet(`online:${userId}`)),

  getSession: async (sid: string) => cacheGet(`session:${sid}`),
  setSession: async (sid: string, uid: string, ttl: number) => cacheSet(`session:${sid}`, uid, ttl),
  deleteSession: async (sid: string) => cacheDel(`session:${sid}`),

  incrementPostLikes: async (postId: string) => {
    const redis = getRedis();
    if (redis instanceof Redis) return await redis.incr(`post:${postId}:likes`);
    return await (redis as UpstashRedis).incr(`post:${postId}:likes`);
  },
  decrementPostLikes: async (postId: string) => {
    const redis = getRedis();
    if (redis instanceof Redis) return await redis.decr(`post:${postId}:likes`);
    return await (redis as UpstashRedis).decr(`post:${postId}:likes`);
  },
  getVisitorCount: async (id: string) => (await cacheGet(`visitors:${id}`)) || 0,
  incrementVisitorCount: async (id: string) => {
    const redis = getRedis();
    if (redis instanceof Redis) return await redis.incr(`visitors:${id}`);
    return await (redis as UpstashRedis).incr(`visitors:${id}`);
  },
  setVisitorCount: async (id: string, count: number) => cacheSet(`visitors:${id}`, count),
};

// Export redis instance for direct access
export { redis };
