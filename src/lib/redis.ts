import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';

let redis: Redis | UpstashRedis | null = null;

// Simple In-Memory Cache Fallback for Local Development/Testing when Redis is missing
class MemoryCache {
  private cache = new Map<string, { value: any, expiry: number }>();

  async get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value; // Already parsed
  }

  async set(key: string, value: any, ttlSeconds?: number | string) {
    // Handle 'EX', ttl syntax from ioredis if passed as args, but here we just take the 3rd arg
    const ttl = typeof ttlSeconds === 'number' ? ttlSeconds : 60;
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });
    return 'OK';
  }

  async del(key: string) {
    this.cache.delete(key);
    return 1;
  }

  async lrange(key: string, start: number, stop: number) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) return [];
    // Redis LRANGE is inclusive [start, stop]
    // If stop is -1, it means end
    const end = stop === -1 ? undefined : stop + 1;
    return item.value.slice(start, end);
  }

  async lpush(key: string, ...values: any[]) {
    let item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) {
      item = { value: [], expiry: Date.now() + (3600 * 1000 * 24) }; // Default 24h
      this.cache.set(key, item);
    }
    // Redis lpush prepends
    item.value.unshift(...values);
    return item.value.length;
  }

  async ltrim(key: string, start: number, stop: number) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) return 'OK';
    
    // Redis LTRIM keeps elements in range [start, stop]
    const end = stop === -1 ? undefined : stop + 1;
    item.value = item.value.slice(start, end);
    return 'OK';
  }

  async llen(key: string) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) return 0;
    return item.value.length;
  }
}

const memoryCache = new MemoryCache();
let useMemoryFallback = false;

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

      let client: Redis;
      
      // Support REDIS_URL (Standard on Render/Heroku)
      if (process.env.REDIS_URL) {
        client = new Redis(process.env.REDIS_URL, {
          retryStrategy: (times) => {
            if (times > 3) {
              console.warn('⚠️  Redis connection failed, switching to In-Memory Cache');
              useMemoryFallback = true;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: null,
          connectTimeout: 2000, // Faster timeout
          lazyConnect: true
        });
      } else {
        // Manual configuration
        client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          retryStrategy: (times) => {
            if (times > 3) {
              console.warn('⚠️  Redis connection failed, switching to In-Memory Cache');
              useMemoryFallback = true;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: null,
          connectTimeout: 2000, // Faster timeout
          lazyConnect: true
        });
      }

      client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        useMemoryFallback = false;
      });

      client.on('error', (err) => {
        // console.warn('⚠️  Redis error (continuing without cache):', err.message);
      });

      // Try to connect but don't block if it fails
      client.connect().catch(() => {
        console.warn('⚠️  Redis unavailable, switching to In-Memory Cache');
        useMemoryFallback = true;
      });

      redis = client;
      return redis;
    }
  } catch (error) {
    console.warn('⚠️  Failed to initialize Redis:', error);
    useMemoryFallback = true;
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
    if (useMemoryFallback) {
        return memoryCache.get(key);
    }
    const redis = getRedis();
    if (!redis) {
        useMemoryFallback = true;
        return memoryCache.get(key);
    }
    // Check if it's ioredis (status property) and if it's connected
    if ((redis as any).status && (redis as any).status !== 'ready') {
         return memoryCache.get(key);
    }

    const data = await redis.get(key);
    // Upstash might return object if it was stored as JSON? No, we stringify.
    // ioredis returns string or null. Upstash returns string or null or number etc.
    // We assume string for JSON.parse
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  } catch (error) {
    // console.warn('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, data: any, ttlSeconds: number = 3600) => {
  try {
    if (useMemoryFallback) {
        return memoryCache.set(key, data, ttlSeconds);
    }

    const redis = getRedis();
    if (!redis) {
         useMemoryFallback = true;
         return memoryCache.set(key, data, ttlSeconds);
    }

    // Check if it's ioredis (status property) and if it's connected
    if ((redis as any).status && (redis as any).status !== 'ready') {
        return memoryCache.set(key, data, ttlSeconds);
    }

    const value = JSON.stringify(data);
    
    // Handle both ioredis and Upstash signatures
    // ioredis: set(key, value, 'EX', ttl)
    // Upstash: set(key, value, { ex: ttl }) or set(key, value, 'EX', ttl)
    
    // We'll try the common denominator or check type
    if ((redis as any).setex) {
        // ioredis often has setex
         await (redis as any).setex(key, ttlSeconds, value);
    } else {
         // Upstash or generic
         await redis.set(key, value, { ex: ttlSeconds } as any);
    }
  } catch (error) {
    // console.warn('Cache set error:', error);
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
  const client = initRedis();
  if (!client || useMemoryFallback) {
    // Memory cache doesn't support pattern matching easily without iterating
    // For now, ignore or implement simple scan if critical
    // Simple implementation:
    // @ts-ignore
    for (const key of memoryCache.cache.keys()) {
      // Simple wildcard match
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      if (regex.test(key)) {
        memoryCache.del(key);
      }
    }
    return;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.error('Redis invalidate error:', error);
  }
};

export const cacheLPush = async (key: string, ...values: any[]) => {
  const client = initRedis();
  try {
    if (!client || useMemoryFallback) {
      return await memoryCache.lpush(key, ...values);
    }
    // Handle both Redis and Upstash
    // @ts-ignore - Upstash/IORedis compatible
    return await client.lpush(key, ...values);
  } catch (error) {
    console.error('Redis LPUSH error:', error);
    return 0;
  }
};

export const cacheLTrim = async (key: string, start: number, stop: number) => {
  const client = initRedis();
  try {
    if (!client || useMemoryFallback) {
      return await memoryCache.ltrim(key, start, stop);
    }
    // @ts-ignore
    return await client.ltrim(key, start, stop);
  } catch (error) {
    console.error('Redis LTRIM error:', error);
    return 'OK';
  }
};

export const cacheLLen = async (key: string): Promise<number> => {
  try {
    if (useMemoryFallback) {
        return memoryCache.llen(key);
    }
    const redis = getRedis();
    if (!redis) {
        useMemoryFallback = true;
        return memoryCache.llen(key);
    }
    if ((redis as any).status && (redis as any).status !== 'ready') {
        return memoryCache.llen(key);
    }
    return await redis.llen(key);
  } catch (error) {
    // console.warn('Cache llen error:', error);
    return 0;
  }
};

export const cacheLRange = async (key: string, start: number, stop: number): Promise<string[]> => {
  try {
    if (useMemoryFallback) {
        return memoryCache.lrange(key, start, stop);
    }
    const redis = getRedis();
    if (!redis) {
        useMemoryFallback = true;
        return memoryCache.lrange(key, start, stop);
    }
    if ((redis as any).status && (redis as any).status !== 'ready') {
        return memoryCache.lrange(key, start, stop);
    }
    return await redis.lrange(key, start, stop);
  } catch (error) {
    // console.warn('Cache lrange error:', error);
    return [];
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
