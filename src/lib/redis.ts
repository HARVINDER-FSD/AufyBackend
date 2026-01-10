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
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Cache invalidate error:', error);
    return false;
  }
};
