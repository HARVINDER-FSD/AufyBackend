"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const authenticateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        // Log token format for debugging (first/last 10 chars only)
        if (token.length < 20) {
            console.error('⚠️ Token too short:', token.length, 'chars');
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Just attach the userId from token - don't verify user exists here
        // Let individual routes handle user lookup with proper ID format handling
        req.user = { userId: decoded.userId };
        req.userId = decoded.userId;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error.message);
        console.error('Token format issue - client needs to clear cache and login again');
        return res.status(403).json({
            message: 'Invalid or expired token',
            hint: 'Please logout and login again to get a fresh token'
        });
    }
});
exports.authenticateToken = authenticateToken;
// Optional authentication - doesn't fail if no token provided
const optionalAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield user_1.default.findById(decoded.userId).select('-password');
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
});
exports.optionalAuth = optionalAuth;
exports.default = exports.authenticateToken;
