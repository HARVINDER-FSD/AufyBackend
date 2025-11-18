import { Request, Response, NextFunction } from 'express';
import { cache } from '../lib/cache';

/**
 * Cache middleware for GET requests
 * Usage: router.get('/path', cacheMiddleware(300), handler)
 */
export function cacheMiddleware(ttlSeconds: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `route:${req.originalUrl}`;

    // Try to get from cache
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(data: any) {
      // Cache the response
      cache.set(cacheKey, data, ttlSeconds);
      
      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache for specific patterns
 */
export function invalidateCache(pattern: string) {
  cache.deletePattern(pattern);
  console.log(`🗑️  Cache invalidated: ${pattern}`);
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  cache.clear();
  console.log('🗑️  All cache cleared');
}
