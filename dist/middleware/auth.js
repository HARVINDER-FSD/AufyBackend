"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = __importDefault(require("../models/user"));
// JWT secret key - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Find user by ID
        const user = await user_1.default.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Attach user to request object
        req.user = user;
        req.userId = decoded.userId;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
        if (!token) {
            // No token provided, continue without user
            return next();
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Find user by ID
        const user = await user_1.default.findById(decoded.userId).select('-password');
        if (user) {
            // Attach user to request object if found
            req.user = user;
            req.userId = decoded.userId;
        }
        next();
    }
    catch (error) {
        // Token invalid, but continue without user
        console.error('Optional auth error:', error);
        next();
    }
};
exports.optionalAuth = optionalAuth;
exports.default = exports.authenticateToken;
