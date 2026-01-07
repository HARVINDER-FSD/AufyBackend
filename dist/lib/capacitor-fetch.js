"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacitorFetch = capacitorFetch;
exports.useCachedFetch = useCachedFetch;
// Enhanced fetch with caching for Capacitor
const core_1 = require("@capacitor/core");
const capacitor_cache_1 = require("./capacitor-cache");
async function capacitorFetch(url, options = {}) {
    const isNative = core_1.Capacitor.isNativePlatform();
    const { cache = 'cache-first', cacheTime = 5 * 60 * 1000, ...fetchOptions } = options;
    // If not native or no-cache, use regular fetch
    if (!isNative || cache === 'no-cache') {
        return fetch(url, fetchOptions);
    }
    // Try to get from cache first
    if (cache === 'cache-first' || cache === 'force-cache') {
        const cached = await capacitor_cache_1.capacitorCache.getCachedAPIResponse(url);
        if (cached) {
            console.log(`📦 Using cached response for ${url}`);
            // Return cached data as Response
            return new Response(JSON.stringify(cached), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    // If force-cache and no cache, throw error
    if (cache === 'force-cache') {
        throw new Error(`No cache available for ${url}`);
    }
    // Fetch from network
    try {
        const response = await fetch(url, fetchOptions);
        const data = await response.clone().json();
        // Cache the response
        await capacitor_cache_1.capacitorCache.cacheAPIResponse(url, data);
        return response;
    }
    catch (error) {
        // If network fails, try cache as fallback
        const cached = await capacitor_cache_1.capacitorCache.getCachedAPIResponse(url);
        if (cached) {
            console.log(`🔄 Network failed, using cached response for ${url}`);
            return new Response(JSON.stringify(cached), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        throw error;
    }
}
// Hook for using cached fetch in React
function useCachedFetch() {
    return capacitorFetch;
}
