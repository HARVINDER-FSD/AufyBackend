"use strict";
// Mobile optimization utilities
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasGoodPerformance = exports.preloadImage = exports.throttle = exports.debounce = exports.fetchWithTimeout = exports.shouldReduceMotion = exports.lazyLoadConfig = exports.isSlowConnection = exports.isMobile = void 0;
const isMobile = () => {
    if (typeof window === 'undefined')
        return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
exports.isMobile = isMobile;
const isSlowConnection = () => {
    if (typeof navigator === 'undefined' || !('connection' in navigator))
        return false;
    const conn = navigator.connection;
    return conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g' || conn?.saveData;
};
exports.isSlowConnection = isSlowConnection;
// Lazy load images on mobile
exports.lazyLoadConfig = {
    loading: 'lazy',
    placeholder: 'blur',
};
// Reduce animation on slow devices
const shouldReduceMotion = () => {
    if (typeof window === 'undefined')
        return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || (0, exports.isSlowConnection)();
};
exports.shouldReduceMotion = shouldReduceMotion;
// Optimize fetch for mobile
const fetchWithTimeout = async (url, options = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    }
    catch (error) {
        clearTimeout(id);
        throw error;
    }
};
exports.fetchWithTimeout = fetchWithTimeout;
// Debounce for mobile input
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};
exports.debounce = debounce;
// Throttle for scroll events
const throttle = (func, limit) => {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};
exports.throttle = throttle;
// Preload critical resources
const preloadImage = (src) => {
    if (typeof window === 'undefined')
        return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
};
exports.preloadImage = preloadImage;
// Check if device has good performance
const hasGoodPerformance = () => {
    if (typeof navigator === 'undefined')
        return true;
    const memory = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency;
    // Device has at least 4GB RAM and 4 cores
    return (!memory || memory >= 4) && (!cores || cores >= 4);
};
exports.hasGoodPerformance = hasGoodPerformance;
