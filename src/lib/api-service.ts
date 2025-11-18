/**
 * Central API service for handling all API requests
 * Provides consistent error handling and authentication
 */

// Helper to get auth token from various storage locations
const getAuthToken = (): string | null => {
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
      token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];
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
const apiRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<any> => {
  try {
    const token = getAuthToken();
    
    // Set up headers with auth token if available
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Make the request
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });
    
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
    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// API service with methods for different endpoints
export const apiService = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) => 
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    
    register: (userData: any) => 
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    
    logout: () => 
      apiRequest('/api/auth/logout', { method: 'POST' }),
  },
  
  // User endpoints
  users: {
    getProfile: (username: string) => 
      apiRequest(`/api/users/${username}`),
    
    updateProfile: (username: string, userData: any) => 
      apiRequest(`/api/users/${username}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),
    
    getSettings: () => 
      apiRequest('/api/settings'),
    
    updateSettings: (settings: any) => 
      apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
  },
  
  // Posts endpoints
  posts: {
    getFeed: () => 
      apiRequest('/api/posts'),
    
    getPost: (postId: string) => 
      apiRequest(`/api/posts/${postId}`),
    
    createPost: (postData: any) => 
      apiRequest('/api/posts', {
        method: 'POST',
        body: JSON.stringify(postData),
      }),
    
    likePost: (postId: string) => 
      apiRequest(`/api/posts/${postId}/like`, { method: 'POST' }),
    
    unlikePost: (postId: string) => 
      apiRequest(`/api/posts/${postId}/like`, { method: 'DELETE' }),
    
    getComments: (postId: string) => 
      apiRequest(`/api/posts/${postId}/comments`),
    
    addComment: (postId: string, content: string) => 
      apiRequest(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },
  
  // Stories endpoints
  stories: {
    getStories: () => 
      apiRequest('/api/stories'),
    
    getStory: (storyId: string) => 
      apiRequest(`/api/stories/${storyId}`),
    
    createStory: (storyData: any) => 
      apiRequest('/api/stories', {
        method: 'POST',
        body: JSON.stringify(storyData),
      }),
  },
  
  // Reels endpoints
  reels: {
    getReels: () => 
      apiRequest('/api/reels'),
    
    getReel: (reelId: string) => 
      apiRequest(`/api/reels/${reelId}`),
    
    likeReel: (reelId: string) => 
      apiRequest(`/api/reels/${reelId}/like`, { method: 'POST' }),
    
    unlikeReel: (reelId: string) => 
      apiRequest(`/api/reels/${reelId}/like`, { method: 'DELETE' }),
  },
  
  // Messages endpoints
  messages: {
    getConversations: () => 
      apiRequest('/api/messages/conversations'),
    
    getMessages: (conversationId: string) => 
      apiRequest(`/api/messages/conversations/${conversationId}`),
    
    sendMessage: (conversationId: string, content: string) => 
      apiRequest(`/api/messages/conversations/${conversationId}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },
  
  // Notifications endpoints
  notifications: {
    getNotifications: () => 
      apiRequest('/api/notifications'),
    
    markAsRead: (notificationId: string) => 
      apiRequest(`/api/notifications/${notificationId}/read`, { method: 'POST' }),
  },
  
  // Search endpoints
  search: {
    searchUsers: (query: string) => 
      apiRequest(`/api/search/users?q=${encodeURIComponent(query)}`),
    
    searchPosts: (query: string) => 
      apiRequest(`/api/search/posts?q=${encodeURIComponent(query)}`),
    
    searchHashtags: (query: string) => 
      apiRequest(`/api/search/hashtags?q=${encodeURIComponent(query)}`),
  },
};

export default apiService;