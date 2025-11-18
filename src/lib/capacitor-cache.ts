// Capacitor-specific caching for instant app loading
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const CACHE_VERSION = 'v1'
const CACHE_KEYS = {
  HTML: `html-cache-${CACHE_VERSION}`,
  API: `api-cache-${CACHE_VERSION}`,
  IMAGES: `image-cache-${CACHE_VERSION}`,
  TIMESTAMP: 'cache-timestamp'
}

// Critical routes to preload and cache
const CRITICAL_ROUTES = [
  '/',
  '/feed',
  '/profile',
  '/messages',
  '/notifications',
  '/reels',
  '/stories'
]

// API endpoints to cache
const CRITICAL_API_ENDPOINTS = [
  '/api/users/me',
  '/api/posts/instagram/feed',
  '/api/notifications',
  '/api/messages/conversations'
]

class CapacitorCache {
  private isNative = Capacitor.isNativePlatform()

  // Initialize cache on app start
  async initialize() {
    if (!this.isNative) return

    console.log('🚀 Initializing Capacitor cache...')
    
    // Check if cache exists
    const cacheTimestamp = await this.getCacheTimestamp()
    const cacheAge = Date.now() - (cacheTimestamp || 0)
    const ONE_HOUR = 60 * 60 * 1000

    // If cache is older than 1 hour, refresh in background
    if (cacheAge > ONE_HOUR) {
      console.log('📦 Cache is stale, refreshing in background...')
      this.refreshCache()
    } else {
      console.log('✅ Cache is fresh')
    }
  }

  // Preload and cache critical routes
  async preloadRoutes() {
    if (!this.isNative) return

    console.log('📥 Preloading critical routes...')
    
    for (const route of CRITICAL_ROUTES) {
      try {
        const response = await fetch(route)
        const html = await response.text()
        await this.cacheHTML(route, html)
      } catch (error) {
        console.error(`Failed to preload ${route}:`, error)
      }
    }

    console.log('✅ Critical routes cached')
  }

  // Cache HTML content
  async cacheHTML(route: string, html: string) {
    if (!this.isNative) return

    try {
      await Preferences.set({
        key: `${CACHE_KEYS.HTML}-${route}`,
        value: html
      })
    } catch (error) {
      console.error('Failed to cache HTML:', error)
    }
  }

  // Get cached HTML
  async getCachedHTML(route: string): Promise<string | null> {
    if (!this.isNative) return null

    try {
      const { value } = await Preferences.get({
        key: `${CACHE_KEYS.HTML}-${route}`
      })
      return value
    } catch (error) {
      console.error('Failed to get cached HTML:', error)
      return null
    }
  }

  // Cache API response
  async cacheAPIResponse(endpoint: string, data: any) {
    if (!this.isNative) return

    try {
      await Preferences.set({
        key: `${CACHE_KEYS.API}-${endpoint}`,
        value: JSON.stringify(data)
      })
    } catch (error) {
      console.error('Failed to cache API response:', error)
    }
  }

  // Get cached API response
  async getCachedAPIResponse(endpoint: string): Promise<any | null> {
    if (!this.isNative) return null

    try {
      const { value } = await Preferences.get({
        key: `${CACHE_KEYS.API}-${endpoint}`
      })
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('Failed to get cached API response:', error)
      return null
    }
  }

  // Refresh cache in background
  async refreshCache() {
    if (!this.isNative) return

    // Update timestamp
    await this.updateCacheTimestamp()

    // Preload routes
    await this.preloadRoutes()

    // Cache API responses
    for (const endpoint of CRITICAL_API_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${await this.getAuthToken()}`
          }
        })
        const data = await response.json()
        await this.cacheAPIResponse(endpoint, data)
      } catch (error) {
        console.error(`Failed to cache ${endpoint}:`, error)
      }
    }

    console.log('✅ Cache refreshed')
  }

  // Get auth token from storage
  async getAuthToken(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: 'auth-token' })
      return value
    } catch {
      return null
    }
  }

  // Update cache timestamp
  async updateCacheTimestamp() {
    await Preferences.set({
      key: CACHE_KEYS.TIMESTAMP,
      value: Date.now().toString()
    })
  }

  // Get cache timestamp
  async getCacheTimestamp(): Promise<number | null> {
    try {
      const { value } = await Preferences.get({ key: CACHE_KEYS.TIMESTAMP })
      return value ? parseInt(value) : null
    } catch {
      return null
    }
  }

  // Clear all cache
  async clearCache() {
    if (!this.isNative) return

    console.log('🗑️ Clearing cache...')
    
    // Clear all cached items
    for (const route of CRITICAL_ROUTES) {
      await Preferences.remove({ key: `${CACHE_KEYS.HTML}-${route}` })
    }

    for (const endpoint of CRITICAL_API_ENDPOINTS) {
      await Preferences.remove({ key: `${CACHE_KEYS.API}-${endpoint}` })
    }

    await Preferences.remove({ key: CACHE_KEYS.TIMESTAMP })

    console.log('✅ Cache cleared')
  }
}

export const capacitorCache = new CapacitorCache()
