import { cacheService, getRedis } from './redis';

/**
 * Legacy cache wrapper that uses the unified Redis instance.
 * This provides backward compatibility for files importing from lib/cache.
 */

export const cache = cacheService;

export async function cacheGet<T>(key: string): Promise<T | null> {
  return cacheService.get(key) as Promise<T | null>;
}

export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  await cacheService.set(key, value, ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  await cacheService.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  await cacheService.invalidate(pattern);
}

// Cache key generators
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userByUsername: (username: string) => `user:username:${username}`,
  post: (postId: string) => `post:${postId}`,
  feed: (userId: string, page: number = 1) => `feed:${userId}:${page}`,
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,
  stories: (userId: string) => `stories:${userId}`,
  userPosts: (userId: string, page: number = 1) => `posts:${userId}:${page}`,
}

// Cache TTL (Time To Live) in seconds
export const cacheTTL = {
  user: 900, // 15 minutes
  post: 600, // 10 minutes
  feed: 300, // 5 minutes
  followers: 600, // 10 minutes
  following: 600, // 10 minutes
  stories: 180, // 3 minutes
  userPosts: 600, // 10 minutes
}

// Helper function to cache with automatic TTL
export async function cacheWithTTL<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key)
  if (cached !== null) {
    return cached
  }

  // Cache miss - fetch data
  const data = await fetchFn()

  // Cache the result
  await cacheSet(key, data, ttl)

  return data
}

// Export redis instance for advanced usage
export const redis = getRedis();
