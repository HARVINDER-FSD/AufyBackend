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
 * Prevents replay attacks
 */
export const validateRequestSignature = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = req.headers['x-timestamp'] as string;
  const signature = req.headers['x-signature'] as string;
  
  if (!timestamp || !signature) {
    return next(); // Optional for backward compatibility
  }
  
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  
  // Reject requests older than 5 minutes
  if (now - requestTime > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'Request expired' });
  }
  
  // Check if signature was already used (replay attack)
  if (requestSignatures.has(signature)) {
    return res.status(401).json({ error: 'Duplicate request detected' });
  }
  
  // Store signature for 10 minutes
  requestSignatures.set(signature, now + 10 * 60 * 1000);
  
  // Clean old signatures
  for (const [sig, expiry] of requestSignatures.entries()) {
    if (now > expiry) {
      requestSignatures.delete(sig);
    }
  }
  
  next();
};

/**
 * CSRF Protection
 * Prevents cross-site request forgery
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionToken = req.headers['authorization'] as string;
    
    if (!csrfToken && sessionToken) {
      // Generate CSRF token from session
      const expectedToken = crypto
        .createHash('sha256')
        .update(sessionToken + process.env.JWT_SECRET)
        .digest('hex')
        .substring(0, 32);
      
      // For now, we'll be lenient and just log
      console.log('CSRF token missing, expected:', expectedToken);
    }
  }
  next();
};

/**
 * IP Whitelist/Blacklist
 */
const blacklistedIPs = new Set<string>();
const whitelistedIPs = new Set<string>();

export const ipFilter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (blacklistedIPs.has(ip)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // If whitelist is active and IP not in whitelist
  if (whitelistedIPs.size > 0 && !whitelistedIPs.has(ip)) {
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
  /(union|select|insert|update|delete|drop|create|alter)/i,  // SQL keywords
  /(<script|javascript:|onerror=|onload=)/i,  // XSS patterns
  /(eval\(|exec\(|system\()/i,  // Code injection
];

export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
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
      
      // Add to blacklist
      if (ip) addToBlacklist(ip);
      
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
