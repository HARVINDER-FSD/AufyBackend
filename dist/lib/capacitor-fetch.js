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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacitorFetch = capacitorFetch;
exports.useCachedFetch = useCachedFetch;
// Enhanced fetch with caching for Capacitor
const core_1 = require("@capacitor/core");
const capacitor_cache_1 = require("./capacitor-cache");
function capacitorFetch(url_1) {
    return __awaiter(this, arguments, void 0, function* (url, options = {}) {
        const isNative = core_1.Capacitor.isNativePlatform();
        const { cache = 'cache-first', cacheTime = 5 * 60 * 1000 } = options, fetchOptions = __rest(options
        // If not native or no-cache, use regular fetch
        , ["cache", "cacheTime"]);
        // If not native or no-cache, use regular fetch
        if (!isNative || cache === 'no-cache') {
            return fetch(url, fetchOptions);
        }
        // Try to get from cache first
        if (cache === 'cache-first' || cache === 'force-cache') {
            const cached = yield capacitor_cache_1.capacitorCache.getCachedAPIResponse(url);
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
            const response = yield fetch(url, fetchOptions);
            const data = yield response.clone().json();
            // Cache the response
            yield capacitor_cache_1.capacitorCache.cacheAPIResponse(url, data);
            return response;
        }
        catch (error) {
            // If network fails, try cache as fallback
            const cached = yield capacitor_cache_1.capacitorCache.getCachedAPIResponse(url);
            if (cached) {
                console.log(`🔄 Network failed, using cached response for ${url}`);
                return new Response(JSON.stringify(cached), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            throw error;
        }
    });
}
// Hook for using cached fetch in React
function useCachedFetch() {
    return capacitorFetch;
}
