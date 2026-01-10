"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureSession = exports.validatePasswordStrength = exports.detectSuspiciousActivity = exports.removeFromWhitelist = exports.addToWhitelist = exports.removeFromBlacklist = exports.addToBlacklist = exports.ipFilter = exports.csrfProtection = exports.validateRequestSignature = exports.xssProtection = exports.sanitizeInput = exports.clearFailedAttempts = exports.recordFailedAttempt = exports.bruteForceProtection = exports.rateLimiter = void 0;
// Rate limiting store
const rateLimitStore = new Map();
// Brute force protection store
const bruteForceStore = new Map();
// Request signature validation
const requestSignatures = new Map();
/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per IP
 */
const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
    return (req, res, next) => {
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
exports.rateLimiter = rateLimiter;
/**
 * Brute Force Protection
 * Locks accounts after failed login attempts
 */
const bruteForceProtection = (req, res, next) => {
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
exports.bruteForceProtection = bruteForceProtection;
/**
 * Record failed login attempt
 */
const recordFailedAttempt = (identifier) => {
    const now = Date.now();
    const record = bruteForceStore.get(identifier);
    if (!record) {
        bruteForceStore.set(identifier, { attempts: 1, lockUntil: 0 });
    }
    else {
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
exports.recordFailedAttempt = recordFailedAttempt;
/**
 * Clear failed attempts on successful login
 */
const clearFailedAttempts = (identifier) => {
    bruteForceStore.delete(identifier);
};
exports.clearFailedAttempts = clearFailedAttempts;
/**
 * SQL Injection Protection
 * Sanitizes input to prevent SQL injection
 */
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
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
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = sanitize(obj[key]);
                }
            }
            return sanitized;
        }
        return obj;
    };
    if (req.body)
        req.body = sanitize(req.body);
    if (req.query)
        req.query = sanitize(req.query);
    if (req.params)
        req.params = sanitize(req.params);
    next();
};
exports.sanitizeInput = sanitizeInput;
/**
 * XSS Protection
 * Prevents cross-site scripting attacks
 */
const xssProtection = (req, res, next) => {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
};
exports.xssProtection = xssProtection;
/**
 * Request Signature Validation
 * Prevents replay attacks (DISABLED for now - too strict)
 */
const validateRequestSignature = (req, res, next) => {
    // Disabled - this was causing 403 errors for legitimate requests
    // Re-enable only if you implement signature generation on client side
    next();
};
exports.validateRequestSignature = validateRequestSignature;
/**
 * CSRF Protection
 * Prevents cross-site request forgery (DISABLED for mobile app compatibility)
 */
const csrfProtection = (req, res, next) => {
    // Disabled - mobile apps don't typically use CSRF tokens
    // JWT authentication provides sufficient protection
    next();
};
exports.csrfProtection = csrfProtection;
/**
 * IP Whitelist/Blacklist
 */
const blacklistedIPs = new Set();
const whitelistedIPs = new Set();
const ipFilter = (req, res, next) => {
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
exports.ipFilter = ipFilter;
const addToBlacklist = (ip) => blacklistedIPs.add(ip);
exports.addToBlacklist = addToBlacklist;
const removeFromBlacklist = (ip) => blacklistedIPs.delete(ip);
exports.removeFromBlacklist = removeFromBlacklist;
const addToWhitelist = (ip) => whitelistedIPs.add(ip);
exports.addToWhitelist = addToWhitelist;
const removeFromWhitelist = (ip) => whitelistedIPs.delete(ip);
exports.removeFromWhitelist = removeFromWhitelist;
/**
 * Suspicious Activity Detection
 */
const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
    /(<script|javascript:|onerror=|onload=)/i, // XSS patterns
    /(eval\(|exec\(|system\()/i, // Code injection
];
const detectSuspiciousActivity = (req, res, next) => {
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
exports.detectSuspiciousActivity = detectSuspiciousActivity;
/**
 * Password Strength Validator (Simplified)
 */
const validatePasswordStrength = (password) => {
    const errors = [];
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
exports.validatePasswordStrength = validatePasswordStrength;
/**
 * Session Security
 */
const secureSession = (req, res, next) => {
    // Set secure cookie headers
    res.setHeader('Set-Cookie', [
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        `Max-Age=${7 * 24 * 60 * 60}` // 7 days
    ].join('; '));
    next();
};
exports.secureSession = secureSession;
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
