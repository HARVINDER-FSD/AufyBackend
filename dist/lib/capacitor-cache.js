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
exports.capacitorCache = void 0;
// Capacitor-specific caching for instant app loading
const core_1 = require("@capacitor/core");
const preferences_1 = require("@capacitor/preferences");
const CACHE_VERSION = 'v1';
const CACHE_KEYS = {
    HTML: `html-cache-${CACHE_VERSION}`,
    API: `api-cache-${CACHE_VERSION}`,
    IMAGES: `image-cache-${CACHE_VERSION}`,
    TIMESTAMP: 'cache-timestamp'
};
// Critical routes to preload and cache
const CRITICAL_ROUTES = [
    '/',
    '/feed',
    '/profile',
    '/messages',
    '/notifications',
    '/reels',
    '/stories'
];
// API endpoints to cache
const CRITICAL_API_ENDPOINTS = [
    '/api/users/me',
    '/api/posts/instagram/feed',
    '/api/notifications',
    '/api/messages/conversations'
];
class CapacitorCache {
    constructor() {
        this.isNative = core_1.Capacitor.isNativePlatform();
    }
    // Initialize cache on app start
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return;
            console.log('🚀 Initializing Capacitor cache...');
            // Check if cache exists
            const cacheTimestamp = yield this.getCacheTimestamp();
            const cacheAge = Date.now() - (cacheTimestamp || 0);
            const ONE_HOUR = 60 * 60 * 1000;
            // If cache is older than 1 hour, refresh in background
            if (cacheAge > ONE_HOUR) {
                console.log('📦 Cache is stale, refreshing in background...');
                this.refreshCache();
            }
            else {
                console.log('✅ Cache is fresh');
            }
        });
    }
    // Preload and cache critical routes
    preloadRoutes() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return;
            console.log('📥 Preloading critical routes...');
            for (const route of CRITICAL_ROUTES) {
                try {
                    const response = yield fetch(route);
                    const html = yield response.text();
                    yield this.cacheHTML(route, html);
                }
                catch (error) {
                    console.error(`Failed to preload ${route}:`, error);
                }
            }
            console.log('✅ Critical routes cached');
        });
    }
    // Cache HTML content
    cacheHTML(route, html) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return;
            try {
                yield preferences_1.Preferences.set({
                    key: `${CACHE_KEYS.HTML}-${route}`,
                    value: html
                });
            }
            catch (error) {
                console.error('Failed to cache HTML:', error);
            }
        });
    }
    // Get cached HTML
    getCachedHTML(route) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return null;
            try {
                const { value } = yield preferences_1.Preferences.get({
                    key: `${CACHE_KEYS.HTML}-${route}`
                });
                return value;
            }
            catch (error) {
                console.error('Failed to get cached HTML:', error);
                return null;
            }
        });
    }
    // Cache API response
    cacheAPIResponse(endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return;
            try {
                yield preferences_1.Preferences.set({
                    key: `${CACHE_KEYS.API}-${endpoint}`,
                    value: JSON.stringify(data)
                });
            }
            catch (error) {
                console.error('Failed to cache API response:', error);
            }
        });
    }
    // Get cached API response
    getCachedAPIResponse(endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return null;
            try {
                const { value } = yield preferences_1.Preferences.get({
                    key: `${CACHE_KEYS.API}-${endpoint}`
                });
                return value ? JSON.parse(value) : null;
            }
            catch (error) {
                console.error('Failed to get cached API response:', error);
                return null;
            }
        });
    }
    // Refresh cache in background
    refreshCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return;
            // Update timestamp
            yield this.updateCacheTimestamp();
            // Preload routes
            yield this.preloadRoutes();
            // Cache API responses
            for (const endpoint of CRITICAL_API_ENDPOINTS) {
                try {
                    const response = yield fetch(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${yield this.getAuthToken()}`
                        }
                    });
                    const data = yield response.json();
                    yield this.cacheAPIResponse(endpoint, data);
                }
                catch (error) {
                    console.error(`Failed to cache ${endpoint}:`, error);
                }
            }
            console.log('✅ Cache refreshed');
        });
    }
    // Get auth token from storage
    getAuthToken() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { value } = yield preferences_1.Preferences.get({ key: 'auth-token' });
                return value;
            }
            catch (_a) {
                return null;
            }
        });
    }
    // Update cache timestamp
    updateCacheTimestamp() {
        return __awaiter(this, void 0, void 0, function* () {
            yield preferences_1.Preferences.set({
                key: CACHE_KEYS.TIMESTAMP,
                value: Date.now().toString()
            });
        });
    }
    // Get cache timestamp
    getCacheTimestamp() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { value } = yield preferences_1.Preferences.get({ key: CACHE_KEYS.TIMESTAMP });
                return value ? parseInt(value) : null;
            }
            catch (_a) {
                return null;
            }
        });
    }
    // Clear all cache
    clearCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isNative)
                return;
            console.log('🗑️ Clearing cache...');
            // Clear all cached items
            for (const route of CRITICAL_ROUTES) {
                yield preferences_1.Preferences.remove({ key: `${CACHE_KEYS.HTML}-${route}` });
            }
            for (const endpoint of CRITICAL_API_ENDPOINTS) {
                yield preferences_1.Preferences.remove({ key: `${CACHE_KEYS.API}-${endpoint}` });
            }
            yield preferences_1.Preferences.remove({ key: CACHE_KEYS.TIMESTAMP });
            console.log('✅ Cache cleared');
        });
    }
}
exports.capacitorCache = new CapacitorCache();
