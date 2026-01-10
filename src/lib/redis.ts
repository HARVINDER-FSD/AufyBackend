import Redis from 'ioredis';

let redis: Redis | null = null;

export const initRedis = () => {
  if (redis) return redis;

  try {
    // Check if using Upstash Redis (REST API)
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (upstashUrl && upstashToken) {
      // Parse Upstash URL to get host and port
      // Format: https://host:port
      const url = new URL(upstashUrl);
      const host = url.hostname;
      const port = url.port || 6379;
      
      // Extract password from token (Upstash uses token as password)
      const password = upstashToken;

      console.log(`🔗 Connecting to Upstash Redis: ${host}:${port}`);

      redis = new Redis({
        host,
        port: parseInt(port.toString()),
        password,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('⚠️  Redis connection failed, continuing without cache');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: null,
        tls: {}, // Enable TLS for Upstash
        connectTimeout: 5000,
        lazyConnect: true
      });
    } else {
      // Fallback to local Redis
      console.log('🔗 Connecting to local Redis');
      
      redis = new Redis({
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
    }

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      console.warn('⚠️  Redis error (continuing without cache):', err.message);
    });

    // Try to connect but don't block if it fails
    redis.connect().catch(() => {
      console.warn('⚠️  Redis unavailable, app will work without caching');
    });

    return redis;
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
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, value: any, ttl: number = 3600) => {
  try {
    const redis = getRedis();
    if (!redis) return false;
    await redis.setex(key, ttl, JSON.stringify(value));
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
