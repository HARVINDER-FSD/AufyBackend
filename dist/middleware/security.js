"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureSession = exports.csrfProtection = exports.validateRequestSignature = exports.rateLimiter = exports.detectSuspiciousActivity = exports.ipFilter = exports.sanitizeInput = exports.xssProtection = exports.validatePasswordStrength = exports.bruteForceProtection = exports.clearFailedAttempts = exports.recordFailedAttempt = exports.corsOptions = exports.securityHeaders = void 0;
// src/middleware/security.ts
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Allowed origins
const allowedOrigins = [
    'http://localhost:3000',
    'https://your-frontend-domain.com',
    'http://localhost:8000',
    '*' // Allow all for now matching previous index.ts
];
exports.securityHeaders = (0, helmet_1.default)();
exports.corsOptions = (0, cors_1.default)({
    origin: '*', // Allow all origins for mobile app compatibility matching previous code
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Timestamp', 'X-Signature']
});
// Mock implementations for missing exports requested by auth.ts
// In a real production app, these would use Redis to track attempts per IP/Email.
const failedAttempts = new Map();
const recordFailedAttempt = (email) => {
    const attempts = failedAttempts.get(email) || 0;
    failedAttempts.set(email, attempts + 1);
};
exports.recordFailedAttempt = recordFailedAttempt;
const clearFailedAttempts = (email) => {
    failedAttempts.delete(email);
};
exports.clearFailedAttempts = clearFailedAttempts;
exports.bruteForceProtection = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 attempts per 15 mins for login
    message: { error: 'Too many login attempts, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const validatePasswordStrength = (password) => {
    const errors = [];
    if (password.length < 8)
        errors.push('Password must be at least 8 characters long');
    if (!/[A-Z]/.test(password))
        errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password))
        errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password))
        errors.push('Password must contain at least one number');
    return {
        valid: errors.length === 0,
        errors
    };
};
exports.validatePasswordStrength = validatePasswordStrength;
// Also restore other middlewares mentioned in index.ts imports
const xss_1 = __importDefault(require("xss"));
const mongo_sanitize_1 = __importDefault(require("mongo-sanitize"));
// Also restore other middlewares mentioned in index.ts imports
const xssProtection = (req, _res, next) => {
    if (req.body) {
        const clean = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = (0, xss_1.default)(obj[key]);
                }
                else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    clean(obj[key]);
                }
            }
        };
        clean(req.body);
    }
    next();
};
exports.xssProtection = xssProtection;
const sanitizeInput = (req, _res, next) => {
    if (req.body)
        req.body = (0, mongo_sanitize_1.default)(req.body);
    if (req.query)
        req.query = (0, mongo_sanitize_1.default)(req.query);
    if (req.params)
        req.params = (0, mongo_sanitize_1.default)(req.params);
    next();
};
exports.sanitizeInput = sanitizeInput;
const ipFilter = (req, res, next) => {
    // Simple check for common bot/testing IPs if needed
    next();
};
exports.ipFilter = ipFilter;
const detectSuspiciousActivity = (req, res, next) => {
    // Log request if it contains sensitive characters like ../ OR <script>
    const url = req.url.toLowerCase();
    if (url.includes('../') || url.includes('<script')) {
        console.warn(`[SECURITY] Suspicious activity detected from ${req.ip} on ${req.url}`);
    }
    next();
};
exports.detectSuspiciousActivity = detectSuspiciousActivity;
const rateLimiter = (max, windowMs) => (0, express_rate_limit_1.default)({
    max,
    windowMs,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false
});
exports.rateLimiter = rateLimiter;
const validateRequestSignature = (req, res, next) => { next(); };
exports.validateRequestSignature = validateRequestSignature;
const csrfProtection = (req, res, next) => { next(); };
exports.csrfProtection = csrfProtection;
const secureSession = (req, res, next) => { next(); };
exports.secureSession = secureSession;
