// In-memory cache for instant data loading
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

export function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// Fetch with instant cache
export async function fetchWithCache<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // Return cached data instantly if available
  const cached = getCachedData<T>(url);
  if (cached) {
    // Refresh in background
    fetch(url, options)
      .then(res => res.json())
      .then(data => setCachedData(url, data))
      .catch(() => {});
    
    return cached;
  }
  
  // Fetch and cache
  const response = await fetch(url, options);
  const data = await response.json();
  setCachedData(url, data);
  
  return data;
}
