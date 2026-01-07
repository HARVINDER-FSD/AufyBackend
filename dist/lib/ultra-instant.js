"use strict";
// ULTRA-INSTANT Loading System
// Makes web app feel like native app (TikTok/Instagram speed)
// Zero loading time through aggressive caching + prefetching
Object.defineProperty(exports, "__esModule", { value: true });
exports.ultraFetch = ultraFetch;
exports.prefetch = prefetch;
exports.setupPrefetchLinks = setupPrefetchLinks;
exports.clearOldCache = clearOldCache;
exports.optimisticLike = optimisticLike;
exports.optimisticComment = optimisticComment;
exports.optimisticFollow = optimisticFollow;
// Multi-layer cache system
const memoryCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes fresh
const STALE_DURATION = 30 * 60 * 1000; // 30 minutes stale-while-revalidate
// IndexedDB for persistent cache (survives page refresh)
let db = null;
async function initDB() {
    if (db)
        return db;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('UltraInstantCache', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('cache')) {
                db.createObjectStore('cache', { keyPath: 'key' });
            }
        };
    });
}
// Get from IndexedDB
async function getFromIndexedDB(key) {
    try {
        const database = await initDB();
        return new Promise((resolve) => {
            const transaction = database.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                if (result && Date.now() - result.timestamp < STALE_DURATION) {
                    resolve(result.data);
                }
                else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    }
    catch {
        return null;
    }
}
// Save to IndexedDB
async function saveToIndexedDB(key, data) {
    try {
        const database = await initDB();
        const transaction = database.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        store.put({ key, data, timestamp: Date.now() });
    }
    catch {
        // Silently fail
    }
}
// INSTANT fetch with 3-layer cache
async function ultraFetch(url, options) {
    const cacheKey = `${url}_${JSON.stringify(options || {})}`;
    // Layer 1: Memory cache (0ms)
    const memCached = memoryCache.get(cacheKey);
    if (memCached && !memCached.stale) {
        // Return instantly, refresh in background
        refreshInBackground(url, options, cacheKey);
        return memCached.data;
    }
    // Layer 2: IndexedDB cache (5-10ms)
    const idbCached = await getFromIndexedDB(cacheKey);
    if (idbCached) {
        // Return quickly, refresh in background
        memoryCache.set(cacheKey, { data: idbCached, timestamp: Date.now(), stale: false });
        refreshInBackground(url, options, cacheKey);
        return idbCached;
    }
    // Layer 3: Network fetch
    return fetchAndCache(url, options, cacheKey);
}
// Fetch and cache at all layers
async function fetchAndCache(url, options, cacheKey) {
    try {
        const response = await fetch(url, { ...options, credentials: 'include' });
        if (!response.ok)
            throw new Error('Network error');
        const data = await response.json();
        // Cache at all layers
        memoryCache.set(cacheKey, { data, timestamp: Date.now(), stale: false });
        saveToIndexedDB(cacheKey, data);
        return data;
    }
    catch (error) {
        // Return stale data if available
        const stale = memoryCache.get(cacheKey);
        if (stale)
            return stale.data;
        throw error;
    }
}
// Background refresh (stale-while-revalidate)
function refreshInBackground(url, options, cacheKey) {
    setTimeout(async () => {
        try {
            await fetchAndCache(url, options, cacheKey);
        }
        catch {
            // Silently fail
        }
    }, 0);
}
// Prefetch data before user needs it
function prefetch(url, options) {
    const cacheKey = `${url}_${JSON.stringify(options || {})}`;
    // Only prefetch if not already cached
    if (!memoryCache.has(cacheKey)) {
        fetchAndCache(url, options, cacheKey).catch(() => { });
    }
}
// Prefetch on link hover/touch
function setupPrefetchLinks() {
    if (typeof window === 'undefined')
        return;
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (link) {
            const href = link.getAttribute('href');
            if (href)
                prefetchPageData(href);
        }
    }, { passive: true });
    document.addEventListener('touchstart', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (link) {
            const href = link.getAttribute('href');
            if (href)
                prefetchPageData(href);
        }
    }, { passive: true });
}
// Prefetch page-specific data
function prefetchPageData(path) {
    if (path.startsWith('/feed')) {
        prefetch('/api/posts/instagram/feed');
    }
    else if (path.startsWith('/reels')) {
        prefetch('/api/reels');
    }
    else if (path.startsWith('/profile')) {
        const username = path.split('/')[2];
        if (username) {
            prefetch(`/api/users/${username}`);
            prefetch(`/api/posts/user/${username}`);
        }
    }
    else if (path.startsWith('/messages')) {
        // Conversations will be prefetched by Firebase
    }
}
// Clear old cache entries
function clearOldCache() {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
        if (now - entry.timestamp > STALE_DURATION) {
            memoryCache.delete(key);
        }
    }
}
// Run cleanup every 5 minutes
if (typeof window !== 'undefined') {
    setInterval(clearOldCache, 5 * 60 * 1000);
}
// Optimistic UI helpers
function optimisticLike(posts, postId, liked) {
    return posts.map(post => post.id === postId
        ? { ...post, liked, likes_count: post.likes_count + (liked ? 1 : -1) }
        : post);
}
function optimisticComment(posts, postId, comment) {
    return posts.map(post => post.id === postId
        ? { ...post, comments_count: post.comments_count + 1 }
        : post);
}
function optimisticFollow(user, following) {
    return {
        ...user,
        is_following: following,
        followers_count: user.followers_count + (following ? 1 : -1)
    };
}
// Initialize on load
if (typeof window !== 'undefined') {
    setupPrefetchLinks();
    // Prefetch common data on app load
    setTimeout(() => {
        prefetch('/api/posts/instagram/feed');
        prefetch('/api/stories');
    }, 1000);
}
