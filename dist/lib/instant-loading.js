"use strict";
// Instant Loading System - Makes app feel instant like Instagram
// Uses optimistic UI, skeleton screens, and aggressive caching
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedData = getCachedData;
exports.setCachedData = setCachedData;
exports.prefetchData = prefetchData;
exports.fetchWithCache = fetchWithCache;
exports.optimisticUpdate = optimisticUpdate;
exports.optimisticDelete = optimisticDelete;
exports.optimisticUpdateItem = optimisticUpdateItem;
exports.clearCache = clearCache;
exports.clearCacheKey = clearCacheKey;
// Cache for instant page loads
const pageCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// Get cached data instantly
function getCachedData(key) {
    const entry = pageCache.get(key);
    if (!entry)
        return null;
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_DURATION) {
        pageCache.delete(key);
        return null;
    }
    return entry.data;
}
// Cache data for instant retrieval
function setCachedData(key, data) {
    pageCache.set(key, {
        data,
        timestamp: Date.now()
    });
}
// Prefetch data in background
async function prefetchData(url) {
    try {
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            setCachedData(url, data);
        }
    }
    catch (error) {
        console.error('Prefetch error:', error);
    }
}
// Fetch with instant cache fallback
async function fetchWithCache(url) {
    // Return cached data instantly
    const cached = getCachedData(url);
    if (cached) {
        // Refresh in background
        prefetchData(url);
        return cached;
    }
    // Fetch fresh data
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();
    setCachedData(url, data);
    return data;
}
// Optimistic update - update UI before API responds
function optimisticUpdate(currentData, newItem, idKey = 'id') {
    return [newItem, ...currentData];
}
// Optimistic delete
function optimisticDelete(currentData, itemId, idKey = 'id') {
    return currentData.filter(item => item[idKey] !== itemId);
}
// Optimistic update existing item
function optimisticUpdateItem(currentData, updatedItem, idKey = 'id') {
    return currentData.map(item => item[idKey] === updatedItem.id ? { ...item, ...updatedItem } : item);
}
// Clear all cache
function clearCache() {
    pageCache.clear();
}
// Clear specific cache
function clearCacheKey(key) {
    pageCache.delete(key);
}
