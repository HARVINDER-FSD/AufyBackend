// Enhanced fetch with caching for Capacitor
import { Capacitor } from '@capacitor/core'
import { capacitorCache } from './capacitor-cache'

interface CachedFetchOptions extends RequestInit {
  cache?: 'force-cache' | 'no-cache' | 'cache-first'
  cacheTime?: number // milliseconds
}

export async function capacitorFetch(
  url: string,
  options: CachedFetchOptions = {}
): Promise<Response> {
  const isNative = Capacitor.isNativePlatform()
  const { cache = 'cache-first', cacheTime = 5 * 60 * 1000, ...fetchOptions } = options

  // If not native or no-cache, use regular fetch
  if (!isNative || cache === 'no-cache') {
    return fetch(url, fetchOptions)
  }

  // Try to get from cache first
  if (cache === 'cache-first' || cache === 'force-cache') {
    const cached = await capacitorCache.getCachedAPIResponse(url)
    
    if (cached) {
      console.log(`📦 Using cached response for ${url}`)
      
      // Return cached data as Response
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // If force-cache and no cache, throw error
  if (cache === 'force-cache') {
    throw new Error(`No cache available for ${url}`)
  }

  // Fetch from network
  try {
    const response = await fetch(url, fetchOptions)
    const data = await response.clone().json()

    // Cache the response
    await capacitorCache.cacheAPIResponse(url, data)

    return response
  } catch (error) {
    // If network fails, try cache as fallback
    const cached = await capacitorCache.getCachedAPIResponse(url)
    if (cached) {
      console.log(`🔄 Network failed, using cached response for ${url}`)
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    throw error
  }
}

// Hook for using cached fetch in React
export function useCachedFetch() {
  return capacitorFetch
}
