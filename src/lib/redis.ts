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
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds?: number | string) {
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
    const actualStop = stop < 0 ? item.value.length + stop + 1 : stop + 1;
    return item.value.slice(start, actualStop);
  }

  async lpush(key: string, ...values: any[]) {
    let item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) {
      item = { value: [], expiry: Date.now() + (3600 * 1000 * 24) }; // Default 24h
      this.cache.set(key, item);
    }
    item.value.unshift(...values);
    return item.value.length;
  }

  async ltrim(key: string, start: number, stop: number) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) return 'OK';
    const actualStop = stop < 0 ? item.value.length + stop + 1 : stop + 1;
    item.value = item.value.slice(start, actualStop);
    return 'OK';
  }

  async llen(key: string) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) return 0;
    return item.value.length;
  }

  async lpop(key: string) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value) || item.value.length === 0) return null;
    return item.value.shift();
  }

  async rpush(key: string, ...values: any[]) {
    let item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) {
      item = { value: [], expiry: Date.now() + (3600 * 1000 * 24) }; // Default 24h
      this.cache.set(key, item);
    }
    item.value.push(...values);
    return item.value.length;
  }

  async lrem(key: string, count: number, value: any) {
    const item = this.cache.get(key);
    if (!item || !Array.isArray(item.value)) return 0;
    
    let removed = 0;
    const initialLength = item.value.length;
    
    if (count === 0) {
      item.value = item.value.filter(v => v !== value);
      removed = initialLength - item.value.length;
    } else {
      item.value = item.value.filter(v => v !== value);
      removed = initialLength - item.value.length;
    }
    return removed;
  }
}

const memoryCache = new MemoryCache();
let useMemoryFallback = false;

export const initRedis = () => {
  // Always use In-Memory Cache and disable Redis logic as requested by user
  console.log('🛡️  Offline Mode: Redis explicitly disabled by user, using In-Memory Cache');
  useMemoryFallback = true;
  return null;
};

export const getRedis = () => {
  if (useMemoryFallback) return null;
  return redis;
};

export const cacheSet = async (key: string, value: any, ttlSeconds?: number): Promise<void> => {
  try {
    if (useMemoryFallback) {
      await memoryCache.set(key, value, ttlSeconds);
      return;
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      await memoryCache.set(key, value, ttlSeconds);
      return;
    }
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      // ioredis uses 'EX', Upstash uses options object or multiple args depending on version
      // Using 'EX' is common for ioredis
      await redisInstance.set(key, stringValue, 'EX', ttlSeconds);
    } else {
      await redisInstance.set(key, stringValue);
    }
  } catch (error) {
    // console.warn('Cache set error:', error);
  }
};

export const cacheGet = async (key: string): Promise<any> => {
  try {
    if (useMemoryFallback) {
      return await memoryCache.get(key);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return await memoryCache.get(key);
    }
    const value = await redisInstance.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    // console.warn('Cache get error:', error);
    return null;
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  try {
    if (useMemoryFallback) {
      await memoryCache.del(key);
      return;
    }
    const redisInstance = getRedis() as any;
    if (redisInstance) {
      await redisInstance.del(key);
    }
  } catch (error) {
    // console.warn('Cache del error:', error);
  }
};

export const cacheInvalidate = async (pattern: string): Promise<void> => {
  try {
    if (useMemoryFallback) {
      // Memory cache pattern invalidation is complex, just clear matching keys
      // For now, skip or implement simple version
      return;
    }
    const redisInstance = getRedis() as any;
    if (redisInstance && typeof redisInstance.keys === 'function') {
      const keys = await redisInstance.keys(pattern);
      if (keys && keys.length > 0) {
        await redisInstance.del(...keys);
      }
    }
  } catch (error) {
    // console.warn('Cache invalidate error:', error);
  }
};

export const cacheLPush = async (key: string, ...values: any[]): Promise<number> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.lpush(key, ...values);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.lpush(key, ...values);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.lpush(key, ...values);
    }
    return await redisInstance.lpush(key, ...values);
  } catch (error) {
    // console.warn('Cache lpush error:', error);
    return 0;
  }
};

export const cacheLTrim = async (key: string, start: number, stop: number): Promise<string> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.ltrim(key, start, stop);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.ltrim(key, start, stop);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.ltrim(key, start, stop);
    }
    return await redisInstance.ltrim(key, start, stop);
  } catch (error) {
    // console.warn('Cache ltrim error:', error);
    return 'OK';
  }
};

export const cacheLLen = async (key: string): Promise<number> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.llen(key);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.llen(key);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.llen(key);
    }
    return await redisInstance.llen(key);
  } catch (error) {
    // console.warn('Cache llen error:', error);
    return 0;
  }
};

export const cacheLPop = async (key: string): Promise<string | null> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.lpop(key);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.lpop(key);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.lpop(key);
    }
    return await redisInstance.lpop(key);
  } catch (error) {
    return null;
  }
};

export const cacheRPush = async (key: string, ...values: any[]): Promise<number> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.rpush(key, ...values);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.rpush(key, ...values);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.rpush(key, ...values);
    }
    return await redisInstance.rpush(key, ...values);
  } catch (error) {
    return 0;
  }
};

export const cacheLRem = async (key: string, count: number, value: any): Promise<number> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.lrem(key, count, value);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.lrem(key, count, value);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.lrem(key, count, value);
    }
    return await redisInstance.lrem(key, count, value);
  } catch (error) {
    return 0;
  }
};

export const cacheLRange = async (key: string, start: number, stop: number): Promise<string[]> => {
  try {
    if (useMemoryFallback) {
      return memoryCache.lrange(key, start, stop);
    }
    const redisInstance = getRedis() as any;
    if (!redisInstance) {
      useMemoryFallback = true;
      return memoryCache.lrange(key, start, stop);
    }
    if (redisInstance.status && redisInstance.status !== 'ready') {
      return memoryCache.lrange(key, start, stop);
    }
    return await redisInstance.lrange(key, start, stop);
  } catch (error) {
    return [];
  }
};
