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
exports.isNativeApp = exports.API_BASE_URL = exports.getAPIBaseURL = void 0;
exports.apiFetch = apiFetch;
// API Configuration for Capacitor
const core_1 = require("@capacitor/core");
// Your Vercel API URL
const VERCEL_API_URL = 'https://anu-f0czhuo0j-hs8339952-1745s-projects.vercel.app';
// Determine API base URL
const getAPIBaseURL = () => {
    // In Capacitor native app, ALWAYS use Vercel for API
    if (core_1.Capacitor.isNativePlatform()) {
        console.log('📱 Running in Capacitor, using Vercel API:', VERCEL_API_URL);
        return VERCEL_API_URL;
    }
    // In browser, use relative URLs (same origin)
    return '';
};
exports.getAPIBaseURL = getAPIBaseURL;
// Enhanced fetch that automatically uses correct API URL
function apiFetch(endpoint, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const baseURL = (0, exports.getAPIBaseURL)();
        const url = `${baseURL}${endpoint}`;
        console.log(`🌐 API Call: ${url}`);
        try {
            const response = yield fetch(url, Object.assign(Object.assign({}, options), { headers: Object.assign({ 'Content-Type': 'application/json' }, options === null || options === void 0 ? void 0 : options.headers) }));
            if (!response.ok) {
                console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            }
            return response;
        }
        catch (error) {
            console.error(`❌ Network Error:`, error);
            throw error;
        }
    });
}
// Export for use in components
exports.API_BASE_URL = (0, exports.getAPIBaseURL)();
// Helper to check if we're in native app
const isNativeApp = () => core_1.Capacitor.isNativePlatform();
exports.isNativeApp = isNativeApp;
