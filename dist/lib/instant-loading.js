"use strict";
// Instant Loading System - Makes app feel instant like Instagram
// Uses optimistic UI, skeleton screens, and aggressive caching
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
function prefetchData(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(url, { credentials: 'include' });
            if (response.ok) {
                const data = yield response.json();
                setCachedData(url, data);
            }
        }
        catch (error) {
            console.error('Prefetch error:', error);
        }
    });
}
// Fetch with instant cache fallback
function fetchWithCache(url) {
    return __awaiter(this, void 0, void 0, function* () {
        // Return cached data instantly
        const cached = getCachedData(url);
        if (cached) {
            // Refresh in background
            prefetchData(url);
            return cached;
        }
        // Fetch fresh data
        const response = yield fetch(url, { credentials: 'include' });
        const data = yield response.json();
        setCachedData(url, data);
        return data;
    });
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
    return currentData.map(item => item[idKey] === updatedItem.id ? Object.assign(Object.assign({}, item), updatedItem) : item);
}
// Clear all cache
function clearCache() {
    pageCache.clear();
}
// Clear specific cache
function clearCacheKey(key) {
    pageCache.delete(key);
}
