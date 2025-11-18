// API Configuration for Capacitor
import { Capacitor } from '@capacitor/core'

// Your Vercel API URL
const VERCEL_API_URL = 'https://anu-f0czhuo0j-hs8339952-1745s-projects.vercel.app'

// Determine API base URL
export const getAPIBaseURL = () => {
  // In Capacitor native app, ALWAYS use Vercel for API
  if (Capacitor.isNativePlatform()) {
    console.log('📱 Running in Capacitor, using Vercel API:', VERCEL_API_URL)
    return VERCEL_API_URL
  }
  
  // In browser, use relative URLs (same origin)
  return ''
}

// Enhanced fetch that automatically uses correct API URL
export async function apiFetch(endpoint: string, options?: RequestInit) {
  const baseURL = getAPIBaseURL()
  const url = `${baseURL}${endpoint}`
  
  console.log(`🌐 API Call: ${url}`)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`)
    }
    
    return response
  } catch (error) {
    console.error(`❌ Network Error:`, error)
    throw error
  }
}

// Export for use in components
export const API_BASE_URL = getAPIBaseURL()

// Helper to check if we're in native app
export const isNativeApp = () => Capacitor.isNativePlatform()
