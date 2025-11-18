/**
 * Fast token getter utility
 * Prioritizes cookie over localStorage for better performance
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Get from cookie
  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(c => c.trim().startsWith('client-token='));
  if (tokenCookie) {
    return tokenCookie.split('=')[1];
  }
  
  // Fallback to localStorage
  return localStorage.getItem("token");
}

/**
 * Set auth token in both cookie and localStorage
 */
export const setAuthToken = (token: string, days: number = 7): void => {
  if (typeof window === 'undefined') return;
  
  // Set cookie
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const secure = window.location.protocol === 'https:';
  document.cookie = `client-token=${token}; expires=${expires.toUTCString()}; path=/; ${secure ? 'secure;' : ''} SameSite=Strict`;
  
  // Set localStorage
  localStorage.setItem("token", token);
}

/**
 * Remove auth token from both cookie and localStorage
 */
export const removeAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  
  // Remove cookie
  document.cookie = 'client-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Remove localStorage
  localStorage.removeItem("token");
}

/**
 * Create authorization headers with token
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}
