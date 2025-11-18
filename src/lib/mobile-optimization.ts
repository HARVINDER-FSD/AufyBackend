// Mobile optimization utilities

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isSlowConnection = () => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) return false;
  const conn = (navigator as any).connection;
  return conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g' || conn?.saveData;
};

// Lazy load images on mobile
export const lazyLoadConfig = {
  loading: 'lazy' as const,
  placeholder: 'blur' as const,
};

// Reduce animation on slow devices
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || isSlowConnection();
};

// Optimize fetch for mobile
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Debounce for mobile input
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Preload critical resources
export const preloadImage = (src: string) => {
  if (typeof window === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
};

// Check if device has good performance
export const hasGoodPerformance = () => {
  if (typeof navigator === 'undefined') return true;
  const memory = (navigator as any).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  
  // Device has at least 4GB RAM and 4 cores
  return (!memory || memory >= 4) && (!cores || cores >= 4);
};
