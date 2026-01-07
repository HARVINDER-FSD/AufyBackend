"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthHeaders = exports.removeAuthToken = exports.setAuthToken = exports.getAuthToken = void 0;
/**
 * Fast token getter utility
 * Prioritizes cookie over localStorage for better performance
 */
const getAuthToken = () => {
    if (typeof window === 'undefined')
        return null;
    // Get from cookie
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('client-token='));
    if (tokenCookie) {
        return tokenCookie.split('=')[1];
    }
    // Fallback to localStorage
    return localStorage.getItem("token");
};
exports.getAuthToken = getAuthToken;
/**
 * Set auth token in both cookie and localStorage
 */
const setAuthToken = (token, days = 7) => {
    if (typeof window === 'undefined')
        return;
    // Set cookie
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const secure = window.location.protocol === 'https:';
    document.cookie = `client-token=${token}; expires=${expires.toUTCString()}; path=/; ${secure ? 'secure;' : ''} SameSite=Strict`;
    // Set localStorage
    localStorage.setItem("token", token);
};
exports.setAuthToken = setAuthToken;
/**
 * Remove auth token from both cookie and localStorage
 */
const removeAuthToken = () => {
    if (typeof window === 'undefined')
        return;
    // Remove cookie
    document.cookie = 'client-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    // Remove localStorage
    localStorage.removeItem("token");
};
exports.removeAuthToken = removeAuthToken;
/**
 * Create authorization headers with token
 */
const getAuthHeaders = () => {
    const token = (0, exports.getAuthToken)();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};
exports.getAuthHeaders = getAuthHeaders;
