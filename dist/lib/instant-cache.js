"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedData = getCachedData;
exports.setCachedData = setCachedData;
exports.clearCache = clearCache;
exports.fetchWithCache = fetchWithCache;
// In-memory cache for instant data loading
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds
function getCachedData(key) {
    const cached = cache.get(key);
    if (!cached)
        return null;
    const now = Date.now();
    if (now - cached.timestamp > CACHE_DURATION) {
        cache.delete(key);
        return null;
    }
    return cached.data;
}
function setCachedData(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}
function clearCache(key) {
    if (key) {
        cache.delete(key);
    }
    else {
        cache.clear();
    }
}
// Fetch with instant cache
async function fetchWithCache(url, options) {
    // Return cached data instantly if available
    const cached = getCachedData(url);
    if (cached) {
        // Refresh in background
        fetch(url, options)
            .then(res => res.json())
            .then(data => setCachedData(url, data))
            .catch(() => { });
        return cached;
    }
    // Fetch and cache
    const response = await fetch(url, options);
    const data = await response.json();
    setCachedData(url, data);
    return data;
}
