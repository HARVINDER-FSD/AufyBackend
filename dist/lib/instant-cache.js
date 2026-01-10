"use strict";
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
function fetchWithCache(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const response = yield fetch(url, options);
        const data = yield response.json();
        setCachedData(url, data);
        return data;
    });
}
