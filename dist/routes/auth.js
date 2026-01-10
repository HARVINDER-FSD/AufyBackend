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
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../lib/database");
const security_1 = require("../middleware/security");
const encryption_1 = require("../utils/encryption");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';
// POST /api/auth/login
router.post('/login', security_1.bruteForceProtection, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        console.log('[LOGIN] Attempt:', { email, passwordLength: password === null || password === void 0 ? void 0 : password.length });
        // Validate required fields
        if (!email || !password) {
            console.log('[LOGIN] Missing fields');
            return res.status(400).json({
                message: "Email and password are required"
            });
        }
        // Connect to MongoDB using shared connection
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        console.log('[LOGIN] Connected to DB:', db.databaseName);
        console.log('[LOGIN] Collection:', usersCollection.collectionName);
        // Count total users
        const totalUsers = yield usersCollection.countDocuments();
        console.log('[LOGIN] Total users in collection:', totalUsers);
        // Find user by email
        const user = yield usersCollection.findOne({ email });
        console.log('[LOGIN] Query:', { email });
        console.log('[LOGIN] User found:', !!user, user ? `(${user.username})` : '');
        if (!user) {
            console.log('[LOGIN] User not found');
            (0, security_1.recordFailedAttempt)(email);
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        console.log('[LOGIN] Has password:', !!user.password);
        // Compare passwords
        const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
        console.log('[LOGIN] Password valid:', isPasswordValid);
        if (!isPasswordValid) {
            console.log('[LOGIN] Invalid password');
            (0, security_1.recordFailedAttempt)(email);
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // Clear failed attempts on successful login
        (0, security_1.clearFailedAttempts)(email);
        // Generate JWT token (90 days - Instagram-style long session)
        const token = jsonwebtoken_1.default.sign({
            userId: user._id.toString(),
            email: user.email,
            username: user.username,
            name: user.name
        }, JWT_SECRET, { expiresIn: '90d' });
        // Set httpOnly cookie for server-side access
        res.cookie('token', token, {
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 90 * 1000, // 90 days in milliseconds
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        // Also set a non-httpOnly cookie for client-side access
        res.cookie('client-token', token, {
            httpOnly: false,
            path: '/',
            maxAge: 60 * 60 * 24 * 90 * 1000, // 7 days in milliseconds
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        // Return user data and token
        const avatarUrl = user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0095f6&color=fff&size=128`;
        return res.json({
            user: {
                _id: user._id.toString(),
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                name: user.name || "",
                fullName: user.name || "",
                bio: user.bio || "",
                avatar: avatarUrl,
                avatar_url: avatarUrl,
                followers: user.followers || 0,
                following: user.following || 0,
                verified: user.verified || false
            },
            token: token
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(error.status || 401).json({
            message: error.message || "Login failed"
        });
    }
}));
// POST /api/auth/register
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, username, name } = req.body;
        // Validate required fields
        if (!email || !password || !username) {
            return res.status(400).json({
                message: "Email, password, and username are required"
            });
        }
        // Connect to MongoDB using shared connection
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_.]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                message: 'Username can only contain letters, numbers, underscores (_), and periods (.)',
                error: 'INVALID_USERNAME_FORMAT'
            });
        }
        // Check username length
        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({
                message: 'Username must be between 3 and 30 characters',
                error: 'INVALID_USERNAME_LENGTH'
            });
        }
        // Check if user already exists
        const existingUser = yield usersCollection.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({
                    message: "Email already registered"
                });
            }
            else {
                // Username is taken - generate suggestions
                const suggestions = [];
                const baseUsername = username.replace(/[0-9]+$/, ''); // Remove trailing numbers
                // Try adding random numbers
                for (let i = 0; i < 5; i++) {
                    const randomNum = Math.floor(Math.random() * 9999) + 1;
                    const suggestion = `${baseUsername}${randomNum}`;
                    // Check if suggestion is available
                    const exists = yield usersCollection.findOne({ username: suggestion });
                    if (!exists && suggestion.length <= 30) {
                        suggestions.push(suggestion);
                    }
                }
                // Try adding underscore and numbers
                if (suggestions.length < 5) {
                    for (let i = 0; i < 3; i++) {
                        const randomNum = Math.floor(Math.random() * 999) + 1;
                        const suggestion = `${baseUsername}_${randomNum}`;
                        const exists = yield usersCollection.findOne({ username: suggestion });
                        if (!exists && suggestion.length <= 30 && !suggestions.includes(suggestion)) {
                            suggestions.push(suggestion);
                        }
                    }
                }
                return res.status(400).json({
                    message: "Username already taken",
                    error: 'USERNAME_TAKEN',
                    suggestions: suggestions.slice(0, 5)
                });
            }
        }
        // Hash password (8 rounds for faster mobile performance)
        const hashedPassword = yield bcryptjs_1.default.hash(password, 8);
        // Create new user with proper avatar fields
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0095f6&color=fff&size=128`;
        const result = yield usersCollection.insertOne({
            email,
            password: hashedPassword,
            username,
            name: name || username,
            full_name: name || username,
            bio: "",
            avatar: defaultAvatar,
            avatar_url: defaultAvatar,
            followers: 0,
            following: 0,
            followers_count: 0,
            following_count: 0,
            verified: false,
            is_verified: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        // Generate JWT token (90 days - Instagram-style long session)
        const token = jsonwebtoken_1.default.sign({
            userId: result.insertedId.toString(),
            email,
            username,
            name: name || username
        }, JWT_SECRET, { expiresIn: '90d' });
        // Set cookies
        res.cookie('token', token, {
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 90 * 1000, // 90 days
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        res.cookie('client-token', token, {
            httpOnly: false,
            path: '/',
            maxAge: 60 * 60 * 24 * 7 * 1000,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        return res.json({
            user: {
                _id: result.insertedId.toString(),
                id: result.insertedId.toString(),
                username,
                email,
                name: name || username,
                fullName: name || username,
                bio: "",
                avatar: defaultAvatar,
                avatar_url: defaultAvatar,
                followers: 0,
                following: 0,
                verified: false
            },
            token
        });
    }
    catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({
            message: error.message || "Registration failed"
        });
    }
}));
// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.clearCookie('client-token');
    return res.json({ message: "Logged out successfully" });
});
// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ email });
        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }
        // Generate secure reset token
        const { token, hash: tokenHash, expires } = (0, encryption_1.generatePasswordResetToken)();
        // Store reset token in database
        yield usersCollection.updateOne({ email }, {
            $set: {
                resetPasswordToken: tokenHash,
                resetPasswordExpires: expires,
                updated_at: new Date()
            }
        });
        // Send password reset email asynchronously (don't wait for it)
        const { sendPasswordResetEmail } = yield Promise.resolve().then(() => __importStar(require('../services/email-resend')));
        sendPasswordResetEmail(email, token, user.username || user.full_name).catch(err => {
            console.error('[FORGOT PASSWORD] Email send error:', err);
        });
        // Respond immediately without waiting for email
        res.json({
            message: 'If an account exists with this email, you will receive a password reset link.'
        });
    }
    catch (error) {
        console.error('[FORGOT PASSWORD] Error:', error);
        res.status(500).json({ message: 'Failed to process request' });
    }
}));
// GET /api/auth/validate-reset-token - Validate if reset token is valid
router.get('/validate-reset-token', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: 'Token is required', valid: false });
        }
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        // Hash the token to compare with stored hash
        const tokenHash = (0, encryption_1.hash)(token);
        // Find user with valid reset token
        const user = yield usersCollection.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: new Date() }
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token', valid: false });
        }
        return res.json({ message: 'Token is valid', valid: true });
    }
    catch (error) {
        console.error('[VALIDATE TOKEN] Error:', error);
        return res.status(500).json({ message: 'Failed to validate token', valid: false });
    }
}));
// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }
        // Validate password strength
        const passwordValidation = (0, security_1.validatePasswordStrength)(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                message: 'Password does not meet requirements',
                errors: passwordValidation.errors
            });
        }
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        // Hash the token to compare with stored hash
        const tokenHash = (0, encryption_1.hash)(token);
        // Find user with valid reset token
        const user = yield usersCollection.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: new Date() }
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }
        // Hash new password
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
        // Update password and clear reset token
        yield usersCollection.updateOne({ _id: user._id }, {
            $set: {
                password: hashedPassword,
                updated_at: new Date()
            },
            $unset: {
                resetPasswordToken: '',
                resetPasswordExpires: ''
            }
        });
        console.log(`[RESET PASSWORD] Password reset successful for user: ${user.email}`);
        // Send confirmation email asynchronously (don't wait for it)
        const { sendPasswordChangedEmail } = yield Promise.resolve().then(() => __importStar(require('../services/email-resend')));
        sendPasswordChangedEmail(user.email, user.username || user.full_name).catch(err => {
            console.error('[RESET PASSWORD] Email send error:', err);
        });
        res.json({ message: 'Password reset successful. You can now login with your new password.' });
    }
    catch (error) {
        console.error('[RESET PASSWORD] Error:', error);
        res.status(500).json({ message: 'Failed to reset password' });
    }
}));
// POST /api/auth/change-password
router.post('/change-password', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { currentPassword, newPassword } = req.body;
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }
        // Validate new password strength
        const passwordValidation = (0, security_1.validatePasswordStrength)(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                message: 'New password does not meet requirements',
                errors: passwordValidation.errors
            });
        }
        // Verify JWT token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: decoded.userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Verify current password
        const isCurrentPasswordValid = yield bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        // Check if new password is same as current
        const isSamePassword = yield bcryptjs_1.default.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }
        // Hash new password
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
        // Update password
        yield usersCollection.updateOne({ _id: user._id }, {
            $set: {
                password: hashedPassword,
                updated_at: new Date()
            }
        });
        console.log(`[CHANGE PASSWORD] Password changed successfully for user: ${user.email}`);
        // Send confirmation email asynchronously (don't wait for it)
        const { sendPasswordChangedEmail } = yield Promise.resolve().then(() => __importStar(require('../services/email-resend')));
        sendPasswordChangedEmail(user.email, user.username || user.full_name).catch(err => {
            console.error('[CHANGE PASSWORD] Email send error:', err);
        });
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('[CHANGE PASSWORD] Error:', error);
        res.status(500).json({ message: 'Failed to change password' });
    }
}));
exports.default = router;
