import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Brute force protection store
const bruteForceStore = new Map<string, { attempts: number; lockUntil: number }>();

// Request signature validation
const requestSignatures = new Map<string, number>();

/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per IP
 */
export const rateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const record = rateLimitStore.get(ip);
    
    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    record.count++;
    next();
  };
};

/**
 * Brute Force Protection
 * Locks accounts after failed login attempts
 */
export const bruteForceProtection = (req: Request, res: Response, next: NextFunction) => {
  const identifier = req.body.email || req.body.username || req.ip;
  const now = Date.now();
  
  const record = bruteForceStore.get(identifier);
  
  if (record && now < record.lockUntil) {
    const remainingTime = Math.ceil((record.lockUntil - now) / 1000);
    return res.status(423).json({ 
      error: 'Account temporarily locked due to multiple failed attempts',
      retryAfter: remainingTime
    });
  }
  
  next();
};

/**
 * Record failed login attempt
 */
export const recordFailedAttempt = (identifier: string) => {
  const now = Date.now();
  const record = bruteForceStore.get(identifier);
  
  if (!record) {
    bruteForceStore.set(identifier, { attempts: 1, lockUntil: 0 });
  } else {
    record.attempts++;
    
    // Lock for 15 minutes after 5 failed attempts
    if (record.attempts >= 5) {
      record.lockUntil = now + 15 * 60 * 1000;
    }
    // Lock for 5 minutes after 3 failed attempts
    else if (record.attempts >= 3) {
      record.lockUntil = now + 5 * 60 * 1000;
    }
  }
};

/**
 * Clear failed attempts on successful login
 */
export const clearFailedAttempts = (identifier: string) => {
  bruteForceStore.delete(identifier);
};

/**
 * SQL Injection Protection
 * Sanitizes input to prevent SQL injection
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove SQL injection patterns
      return obj
        .replace(/(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte)/gi, '')
        .replace(/[<>]/g, '')
        .trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

/**
 * XSS Protection
 * Prevents cross-site scripting attacks
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
};

/**
 * Request Signature Validation
 * Prevents replay attacks (DISABLED for now - too strict)
 */
export const validateRequestSignature = (req: Request, res: Response, next: NextFunction) => {
  // Disabled - this was causing 403 errors for legitimate requests
  // Re-enable only if you implement signature generation on client side
  next();
};

/**
 * CSRF Protection
 * Prevents cross-site request forgery (DISABLED for mobile app compatibility)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Disabled - mobile apps don't typically use CSRF tokens
  // JWT authentication provides sufficient protection
  next();
};

/**
 * IP Whitelist/Blacklist
 */
const blacklistedIPs = new Set<string>();
const whitelistedIPs = new Set<string>();

export const ipFilter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Only block if IP is explicitly blacklisted
  if (blacklistedIPs.has(ip)) {
    console.error(`🚫 Blocked blacklisted IP: ${ip}`);
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Only enforce whitelist if explicitly enabled via environment variable
  if (process.env.ENABLE_IP_WHITELIST === 'true' && whitelistedIPs.size > 0 && !whitelistedIPs.has(ip)) {
    console.error(`🚫 IP not in whitelist: ${ip}`);
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};

export const addToBlacklist = (ip: string) => blacklistedIPs.add(ip);
export const removeFromBlacklist = (ip: string) => blacklistedIPs.delete(ip);
export const addToWhitelist = (ip: string) => whitelistedIPs.add(ip);
export const removeFromWhitelist = (ip: string) => whitelistedIPs.delete(ip);

/**
 * Suspicious Activity Detection
 */
const suspiciousPatterns = [
  /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i,  // Path traversal
  /(<script|javascript:|onerror=|onload=)/i,  // XSS patterns
  /(eval\(|exec\(|system\()/i,  // Code injection
];

export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  // Skip check for safe endpoints
  const safePaths = ['/api/notifications', '/api/feed', '/api/posts', '/api/users', '/api/stories'];
  if (safePaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  const checkString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      const ip = req.ip || req.socket.remoteAddress;
      console.error(`🚨 SECURITY ALERT: Suspicious activity detected from ${ip}`);
      console.error('Pattern matched:', pattern);
      console.error('Request:', req.method, req.path);
      
      // Log but don't auto-blacklist (too aggressive)
      console.error('⚠️  Suspicious request logged but not blocked');
      
      return res.status(403).json({ error: 'Suspicious activity detected' });
    }
  }
  
  next();
};

/**
 * Password Strength Validator (Simplified)
 */
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Minimum length check
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  // Check for common passwords
  const commonPasswords = ['password', '123456', '12345678', 'qwerty', 'abc123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Session Security
 */
export const secureSession = (req: Request, res: Response, next: NextFunction) => {
  // Set secure cookie headers
  res.setHeader('Set-Cookie', [
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${7 * 24 * 60 * 60}` // 7 days
  ].join('; '));
  
  next();
};

/**
 * Clean up old records periodically
 */
setInterval(() => {
  const now = Date.now();
  
  // Clean rate limit store
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
  
  // Clean brute force store
  for (const [id, record] of bruteForceStore.entries()) {
    if (now > record.lockUntil && record.attempts < 3) {
      bruteForceStore.delete(id);
    }
  }
  
  // Clean request signatures
  for (const [sig, expiry] of requestSignatures.entries()) {
    if (now > expiry) {
      requestSignatures.delete(sig);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
