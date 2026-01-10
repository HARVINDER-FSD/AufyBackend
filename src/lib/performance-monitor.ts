/**
 * Performance Monitoring Utility
 * Tracks API response times and identifies bottlenecks
 */

interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: Date;
  status: number;
  userId?: string;
}

const metrics: PerformanceMetric[] = [];
const METRICS_LIMIT = 10000; // Keep last 10k metrics

export const recordMetric = (
  endpoint: string,
  method: string,
  duration: number,
  status: number,
  userId?: string
) => {
  metrics.push({
    endpoint,
    method,
    duration,
    timestamp: new Date(),
    status,
    userId
  });

  // Keep metrics array size manageable
  if (metrics.length > METRICS_LIMIT) {
    metrics.shift();
  }

  // Log slow requests
  if (duration > 1000) {
    console.warn(`⚠️  SLOW REQUEST: ${method} ${endpoint} took ${duration}ms`);
  }
};

export const getMetrics = (endpoint?: string, method?: string) => {
  let filtered = metrics;

  if (endpoint) {
    filtered = filtered.filter(m => m.endpoint.includes(endpoint));
  }

  if (method) {
    filtered = filtered.filter(m => m.method === method);
  }

  return filtered;
};

export const getPerformanceSummary = () => {
  if (metrics.length === 0) {
    return { message: 'No metrics recorded' };
  }

  const summary: any = {};

  // Group by endpoint
  metrics.forEach(m => {
    const key = `${m.method} ${m.endpoint}`;
    if (!summary[key]) {
      summary[key] = {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0
      };
    }

    summary[key].count++;
    summary[key].totalDuration += m.duration;
    summary[key].minDuration = Math.min(summary[key].minDuration, m.duration);
    summary[key].maxDuration = Math.max(summary[key].maxDuration, m.duration);
    if (m.status >= 400) summary[key].errors++;
  });

  // Calculate averages
  Object.keys(summary).forEach(key => {
    const data = summary[key];
    data.avgDuration = Math.round(data.totalDuration / data.count);
  });

  return summary;
};

export const getSlowRequests = (threshold: number = 1000) => {
  return metrics
    .filter(m => m.duration > threshold)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20);
};

export const getErrorRequests = () => {
  return metrics
    .filter(m => m.status >= 400)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);
};

export const clearMetrics = () => {
  metrics.length = 0;
};

// Performance targets
export const PERFORMANCE_TARGETS = {
  'GET /api/users/me': 300,
  'GET /api/users/username/:username': 500,
  'GET /api/users/:userId/posts': 500,
  'GET /api/posts/feed': 500,
  'GET /api/search': 500,
  'POST /api/posts': 1000,
  'POST /api/users/:userId/follow': 500,
  'GET /api/users/:userId/followers': 500,
  'POST /api/chat/messages': 500,
  'GET /api/chat/messages/:userId': 500
};

export const checkPerformanceTargets = () => {
  const summary = getPerformanceSummary();
  const violations: any[] = [];

  Object.keys(summary).forEach(endpoint => {
    const target = Object.keys(PERFORMANCE_TARGETS).find(t => {
      const pattern = t.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(endpoint);
    });

    if (target && summary[endpoint].avgDuration > PERFORMANCE_TARGETS[target as keyof typeof PERFORMANCE_TARGETS]) {
      violations.push({
        endpoint,
        target: PERFORMANCE_TARGETS[target as keyof typeof PERFORMANCE_TARGETS],
        actual: summary[endpoint].avgDuration,
        violation: summary[endpoint].avgDuration - PERFORMANCE_TARGETS[target as keyof typeof PERFORMANCE_TARGETS]
      });
    }
  });

  return violations;
};
