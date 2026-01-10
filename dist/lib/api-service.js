"use strict";
/**
 * Central API service for handling all API requests
 * Provides consistent error handling and authentication
 */
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
exports.apiService = void 0;
// Helper to get auth token from various storage locations
const getAuthToken = () => {
    var _a;
    // For browser environments
    if (typeof window !== 'undefined') {
        // Try localStorage first
        let token = localStorage.getItem('token');
        // Try sessionStorage as fallback
        if (!token) {
            token = sessionStorage.getItem('token');
        }
        // Try cookies as final fallback
        if (!token) {
            token = (_a = document.cookie
                .split('; ')
                .find(row => row.startsWith('token='))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
        }
        // Clean token if it exists (remove quotes)
        if (token) {
            token = token.replace(/^["'](.*)["']$/, '$1');
        }
        return token;
    }
    return null;
};
// Base API request function with auth and error handling
const apiRequest = (endpoint_1, ...args_1) => __awaiter(void 0, [endpoint_1, ...args_1], void 0, function* (endpoint, options = {}) {
    try {
        const token = getAuthToken();
        // Set up headers with auth token if available
        const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers);
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        // Make the request
        const response = yield fetch(endpoint, Object.assign(Object.assign({}, options), { headers }));
        // Handle unauthorized responses
        if (response.status === 401) {
            // Redirect to login if in browser
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            throw new Error('Authentication required');
        }
        // Handle other error responses
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        // Parse and return JSON response
        return yield response.json();
    }
    catch (error) {
        console.error(`API request failed for ${endpoint}:`, error);
        throw error;
    }
});
// API service with methods for different endpoints
exports.apiService = {
    // Auth endpoints
    auth: {
        login: (email, password) => apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
        register: (userData) => apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        }),
        logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
    },
    // User endpoints
    users: {
        getProfile: (username) => apiRequest(`/api/users/${username}`),
        updateProfile: (username, userData) => apiRequest(`/api/users/${username}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        }),
        getSettings: () => apiRequest('/api/settings'),
        updateSettings: (settings) => apiRequest('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(settings),
        }),
    },
    // Posts endpoints
    posts: {
        getFeed: () => apiRequest('/api/posts'),
        getPost: (postId) => apiRequest(`/api/posts/${postId}`),
        createPost: (postData) => apiRequest('/api/posts', {
            method: 'POST',
            body: JSON.stringify(postData),
        }),
        likePost: (postId) => apiRequest(`/api/posts/${postId}/like`, { method: 'POST' }),
        unlikePost: (postId) => apiRequest(`/api/posts/${postId}/like`, { method: 'DELETE' }),
        getComments: (postId) => apiRequest(`/api/posts/${postId}/comments`),
        addComment: (postId, content) => apiRequest(`/api/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),
    },
    // Stories endpoints
    stories: {
        getStories: () => apiRequest('/api/stories'),
        getStory: (storyId) => apiRequest(`/api/stories/${storyId}`),
        createStory: (storyData) => apiRequest('/api/stories', {
            method: 'POST',
            body: JSON.stringify(storyData),
        }),
    },
    // Reels endpoints
    reels: {
        getReels: () => apiRequest('/api/reels'),
        getReel: (reelId) => apiRequest(`/api/reels/${reelId}`),
        likeReel: (reelId) => apiRequest(`/api/reels/${reelId}/like`, { method: 'POST' }),
        unlikeReel: (reelId) => apiRequest(`/api/reels/${reelId}/like`, { method: 'DELETE' }),
    },
    // Messages endpoints
    messages: {
        getConversations: () => apiRequest('/api/messages/conversations'),
        getMessages: (conversationId) => apiRequest(`/api/messages/conversations/${conversationId}`),
        sendMessage: (conversationId, content) => apiRequest(`/api/messages/conversations/${conversationId}`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),
    },
    // Notifications endpoints
    notifications: {
        getNotifications: () => apiRequest('/api/notifications'),
        markAsRead: (notificationId) => apiRequest(`/api/notifications/${notificationId}/read`, { method: 'POST' }),
    },
    // Search endpoints
    search: {
        searchUsers: (query) => apiRequest(`/api/search/users?q=${encodeURIComponent(query)}`),
        searchPosts: (query) => apiRequest(`/api/search/posts?q=${encodeURIComponent(query)}`),
        searchHashtags: (query) => apiRequest(`/api/search/hashtags?q=${encodeURIComponent(query)}`),
    },
};
exports.default = exports.apiService;
