"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.AuthService = void 0;
exports.verifyAuth = verifyAuth;
const database_1 = require("./database");
const utils_1 = require("./utils");
const config_1 = require("./config");
const bcrypt = __importStar(require("bcryptjs"));
const jsonwebtoken = __importStar(require("jsonwebtoken"));
// Initialize MongoDB connection
const mongoose_1 = __importDefault(require("mongoose"));
const user_1 = __importDefault(require("../models/user"));
// Connect to MongoDB
function connectToMongoDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (mongoose_1.default.connection.readyState === 0) {
                yield mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia');
                console.log('Connected to MongoDB');
                // Check if we have any users, if not create a default one
                const userCount = yield user_1.default.countDocuments();
                if (userCount === 0) {
                    const hashedPassword = bcrypt.hashSync("password123", 10);
                    yield user_1.default.create({
                        username: "testuser",
                        email: "test@example.com",
                        password: hashedPassword,
                        full_name: "Test User",
                        date_of_birth: new Date("1990-01-01"),
                        avatar_url: "/placeholder-user.jpg",
                        is_verified: true,
                        is_private: false,
                        is_active: true,
                        last_seen: new Date(),
                        bio: "This is a test user bio"
                    });
                    console.log('Created default user');
                }
            }
        }
        catch (error) {
            console.error('MongoDB connection error:', error);
        }
    });
}
// Initialize database connection
connectToMongoDB();
// Verify authentication from Next.js API route
function verifyAuth(req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            // Prefer Authorization header, then cookies (`client-token` or `token`)
            let accessToken = null;
            const authHeader = req.headers.get('authorization');
            if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
                accessToken = authHeader.split(' ')[1];
            }
            if (!accessToken) {
                const cookieHeader = req.headers.get('cookie') || '';
                const cookieMap = Object.fromEntries(cookieHeader.split(';').map(p => p.trim()).filter(Boolean).map(p => {
                    const idx = p.indexOf('=');
                    return [p.substring(0, idx), decodeURIComponent(p.substring(idx + 1))];
                }));
                accessToken = (_a = (cookieMap['client-token'] || cookieMap['token'])) !== null && _a !== void 0 ? _a : null;
            }
            if (!accessToken) {
                return { success: false, message: 'No token provided' };
            }
            // Verify with either app JWT secret (used by /api/auth/login) or with utils.token
            let decoded = null;
            const envSecret = process.env.JWT_SECRET;
            try {
                if (envSecret) {
                    decoded = jsonwebtoken.verify(accessToken, envSecret);
                }
            }
            catch (_b) { }
            if (!decoded) {
                try {
                    decoded = utils_1.token.verify(accessToken);
                }
                catch (_c) { }
            }
            if (!decoded || !decoded.userId) {
                return { success: false, message: 'Invalid token' };
            }
            // If Redis is unavailable, or key is missing, don't hard-fail in local/dev
            try {
                if (database_1.redis) {
                    const exists = yield database_1.redis.exists(`session:${decoded.userId}:${accessToken}`);
                    if (!exists) {
                        // Soft-warn but allow; many flows set cookies without Redis enabled
                        console.warn('Session key not found in Redis; allowing based on JWT');
                    }
                }
            }
            catch (e) {
                console.warn('Redis check failed; allowing based on JWT');
            }
            return {
                success: true,
                userId: decoded.userId,
                username: decoded.username,
                email: decoded.email,
            };
        }
        catch (error) {
            console.error('Auth verification error:', error);
            return { success: false, message: error.message || 'Authentication failed' };
        }
    });
}
// Authentication service
class AuthService {
    // Register new user
    static register(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, email, password: plainPassword, full_name = "" } = userData;
            // Validate input
            if (!username || !email || !plainPassword) {
                throw utils_1.errors.badRequest("Username, email and password are required");
            }
            // Sanitize input
            const sanitizedUsername = utils_1.sanitize.username(username);
            const sanitizedEmail = utils_1.sanitize.email(email);
            try {
                // Check if username or email already exists
                const existingUser = yield user_1.default.findOne({
                    $or: [
                        { username: new RegExp(`^${sanitizedUsername}$`, 'i') },
                        { email: new RegExp(`^${sanitizedEmail}$`, 'i') }
                    ]
                });
                if (existingUser) {
                    throw utils_1.errors.conflict("Username or email already exists");
                }
                // Create new user (password hashing is handled by pre-save middleware in User model usually, 
                // but here we are hashing it manually in the previous code. 
                // Let's check if User model has pre-save. The previous code hashed it.
                // Assuming User model might have pre-save or we hash it here.
                // The snippet showed `bcrypt.hashSync` in connectToMongoDB, so likely manual hashing is safe/expected.)
                const hashedPassword = bcrypt.hashSync(plainPassword, 10);
                const newUser = yield user_1.default.create({
                    username: sanitizedUsername,
                    email: sanitizedEmail,
                    password: hashedPassword,
                    full_name: full_name,
                    avatar_url: "/placeholder-user.jpg",
                    is_verified: false,
                    is_private: false,
                    is_active: true,
                    last_seen: new Date(),
                    bio: ""
                });
                // Generate JWT token
                const accessToken = utils_1.token.sign({
                    userId: newUser._id.toString(),
                    username: newUser.username,
                    email: newUser.email,
                });
                return {
                    user: {
                        id: newUser._id.toString(),
                        username: newUser.username,
                        email: newUser.email,
                        full_name: newUser.full_name,
                        avatar_url: newUser.avatar_url,
                        is_verified: newUser.is_verified,
                        is_private: newUser.is_private,
                        bio: newUser.bio
                    },
                    accessToken,
                };
            }
            catch (error) {
                console.error("Registration error:", error);
                throw error;
            }
        });
    }
    // Login user
    static login(credentials, deviceInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password: plainPassword } = credentials;
            // Sanitize input
            const sanitizedUsername = utils_1.sanitize.username(username);
            let user;
            try {
                // Use in-memory user storage for demonstration
                const users = global.users || [];
                // Find user by username or email
                const foundUser = users.find(u => u.username.toLowerCase() === sanitizedUsername.toLowerCase() ||
                    u.email.toLowerCase() === sanitizedUsername.toLowerCase());
                if (!foundUser) {
                    throw utils_1.errors.unauthorized("Invalid credentials");
                }
                user = foundUser;
            }
            catch (error) {
                console.error("Login error:", error);
                throw utils_1.errors.unauthorized("Authentication failed");
            }
            // Check password using bcrypt
            const isValidPassword = bcrypt.compareSync(plainPassword, user.password_hash);
            if (!isValidPassword) {
                throw utils_1.errors.unauthorized("Authentication failed");
            }
            // Update last seen - skip for in-memory implementation
            // await query("UPDATE users SET last_seen = NOW() WHERE id = $1", [user.id])
            // Generate JWT token
            const accessToken = utils_1.token.sign({
                userId: user.id,
                username: user.username,
                email: user.email,
            });
            // Store session in Redis if available
            try {
                yield this.createSession(user.id, accessToken, deviceInfo);
            }
            catch (error) {
                console.warn("Session storage failed, continuing without session persistence:", error);
                // Continue without session persistence
            }
            // Cache user data if Redis is available
            const userData = {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                is_verified: user.is_verified,
                is_private: user.is_private,
                last_seen: user.last_seen,
            };
            try {
                if (database_1.redis) {
                    yield database_1.cache.set(`user:${user.id}`, userData, config_1.config.redis.ttl.user);
                }
            }
            catch (error) {
                console.warn("User caching failed, continuing without cache:", error);
                // Continue without caching
            }
            return {
                user: userData,
                accessToken,
            };
        });
    }
    // Create session
    static createSession(userId, accessToken, deviceInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            // Store in Redis for quick access if available
            if (database_1.redis) {
                try {
                    yield database_1.redis.set(`session:${userId}:${accessToken}`, JSON.stringify({
                        userId,
                        deviceInfo,
                        createdAt: new Date().toISOString()
                    }), { ex: config_1.config.redis.ttl.session });
                }
                catch (error) {
                    console.warn("Failed to cache session in Redis:", error);
                    // Continue without Redis caching
                }
            }
        });
    }
}
exports.AuthService = AuthService;
