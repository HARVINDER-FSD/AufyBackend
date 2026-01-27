import { initRedis } from './redis';
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export class RateLimiter {
  /**
   * Consume points for a specific key (User ID or IP)
   * @param key Unique identifier (userId or IP)
   * @param action Action name (e.g., 'like', 'post', 'login')
   * @param limit Max points allowed
   * @param windowSeconds Time window in seconds
   */
  static async consume(key: string, action: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redis = initRedis();
    
    // Fallback if Redis is not connected
    if (!redis) {
      return { success: true, limit, remaining: limit, reset: 0 };
    }

    // Fixed Window Strategy
    // Key format: ratelimit:{action}:{key}:{window_timestamp}
    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
    const redisKey = `ratelimit:${action}:${key}:${windowStart}`;

    try {
      let count: number;

      if (redis instanceof Redis) {
        // Upstash HTTP Client
        count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.expire(redisKey, windowSeconds);
        }
      } else {
        // IORedis (TCP)
        // Use multi to ensure atomicity of incr + expire on first write
        const multi = (redis as IORedis).multi();
        multi.incr(redisKey);
        // We only strictly need expire on the first one, but setting it every time is safe or we can check
        // Ideally we use a Lua script but this is simple enough
        multi.expire(redisKey, windowSeconds); 
        const results = await multi.exec();
        
        if (results && results[0]) {
           // results[0] is [err, result]
           count = results[0][1] as number;
        } else {
           count = 1; // Fallback
        }
      }

      const remaining = Math.max(0, limit - count);

      return {
        success: count <= limit,
        limit,
        remaining,
        reset: (windowStart + 1) * windowSeconds * 1000
      };

    } catch (error) {
      console.error('Rate Limiter Error:', error);
      // Fail open to avoid blocking legitimate users during Redis outages
      return { success: true, limit, remaining: limit, reset: 0 };
    }
  }
}
