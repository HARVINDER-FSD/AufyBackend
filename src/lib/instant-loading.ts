// Instant Loading System - Makes app feel instant like Instagram
// Uses optimistic UI, skeleton screens, and aggressive caching

// Cache for instant page loads
const pageCache = new Map<string, any>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export interface CacheEntry {
  data: any
  timestamp: number
}

// Get cached data instantly
export function getCachedData(key: string): any | null {
  const entry = pageCache.get(key)
  if (!entry) return null
  
  const age = Date.now() - entry.timestamp
  if (age > CACHE_DURATION) {
    pageCache.delete(key)
    return null
  }
  
  return entry.data
}

// Cache data for instant retrieval
export function setCachedData(key: string, data: any): void {
  pageCache.set(key, {
    data,
    timestamp: Date.now()
  })
}

// Prefetch data in background
export async function prefetchData(url: string): Promise<void> {
  try {
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      setCachedData(url, data)
    }
  } catch (error) {
    console.error('Prefetch error:', error)
  }
}

// Fetch with instant cache fallback
export async function fetchWithCache(url: string): Promise<any> {
  // Return cached data instantly
  const cached = getCachedData(url)
  if (cached) {
    // Refresh in background
    prefetchData(url)
    return cached
  }
  
  // Fetch fresh data
  const response = await fetch(url, { credentials: 'include' })
  const data = await response.json()
  setCachedData(url, data)
  return data
}

// Optimistic update - update UI before API responds
export function optimisticUpdate<T>(
  currentData: T[],
  newItem: T,
  idKey: keyof T = 'id' as keyof T
): T[] {
  return [newItem, ...currentData]
}

// Optimistic delete
export function optimisticDelete<T>(
  currentData: T[],
  itemId: any,
  idKey: keyof T = 'id' as keyof T
): T[] {
  return currentData.filter(item => item[idKey] !== itemId)
}

// Optimistic update existing item
export function optimisticUpdateItem<T>(
  currentData: T[],
  updatedItem: Partial<T> & { id: any },
  idKey: keyof T = 'id' as keyof T
): T[] {
  return currentData.map(item =>
    item[idKey] === updatedItem.id ? { ...item, ...updatedItem } : item
  )
}

// Clear all cache
export function clearCache(): void {
  pageCache.clear()
}

// Clear specific cache
export function clearCacheKey(key: string): void {
  pageCache.delete(key)
}
