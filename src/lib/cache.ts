import Redis from 'ioredis'

// Initialize Redis connection (will use Upstash when configured)
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : null

// Cache wrapper with fallback
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  
  try {
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  if (!redis) return
  
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redis) return
  
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Cache delete error:', error)
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!redis) return
  
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    console.error('Cache delete pattern error:', error)
  }
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
export { redis }
