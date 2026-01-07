"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../lib/database");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('[LOGIN] Attempt:', { email, passwordLength: password?.length });
        // Validate required fields
        if (!email || !password) {
            console.log('[LOGIN] Missing fields');
            return res.status(400).json({
                message: "Email and password are required"
            });
        }
        // Connect to MongoDB using shared connection
        const db = await (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        console.log('[LOGIN] Connected to DB:', db.databaseName);
        console.log('[LOGIN] Collection:', usersCollection.collectionName);
        // Count total users
        const totalUsers = await usersCollection.countDocuments();
        console.log('[LOGIN] Total users in collection:', totalUsers);
        // Find user by email
        const user = await usersCollection.findOne({ email });
        console.log('[LOGIN] Query:', { email });
        console.log('[LOGIN] User found:', !!user, user ? `(${user.username})` : '');
        if (!user) {
            console.log('[LOGIN] User not found');
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        console.log('[LOGIN] Has password:', !!user.password);
        // Compare passwords
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        console.log('[LOGIN] Password valid:', isPasswordValid);
        if (!isPasswordValid) {
            console.log('[LOGIN] Invalid password');
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: user._id.toString(),
            email: user.email,
            username: user.username,
            name: user.name
        }, JWT_SECRET, { expiresIn: '7d' });
        // Set httpOnly cookie for server-side access
        res.cookie('token', token, {
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        // Also set a non-httpOnly cookie for client-side access
        res.cookie('client-token', token, {
            httpOnly: false,
            path: '/',
            maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        // Return user data and token
        return res.json({
            user: {
                _id: user._id.toString(),
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                name: user.name || "",
                fullName: user.name || "",
                bio: user.bio || "",
                avatar: user.avatar || "/placeholder-user.jpg",
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
});
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, username, name } = req.body;
        // Validate required fields
        if (!email || !password || !username) {
            return res.status(400).json({
                message: "Email, password, and username are required"
            });
        }
        // Connect to MongoDB using shared connection
        const db = await (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        // Check if user already exists
        const existingUser = await usersCollection.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) {
            return res.status(400).json({
                message: existingUser.email === email
                    ? "Email already registered"
                    : "Username already taken"
            });
        }
        // Hash password (8 rounds for faster mobile performance)
        const hashedPassword = await bcryptjs_1.default.hash(password, 8);
        // Create new user
        const result = await usersCollection.insertOne({
            email,
            password: hashedPassword,
            username,
            name: name || username,
            bio: "",
            avatar: "/placeholder-user.jpg",
            followers: 0,
            following: 0,
            verified: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: result.insertedId.toString(),
            email,
            username,
            name: name || username
        }, JWT_SECRET, { expiresIn: '7d' });
        // Set cookies
        res.cookie('token', token, {
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 7 * 1000,
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
                avatar: "/placeholder-user.jpg",
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
});
// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.clearCookie('client-token');
    return res.json({ message: "Logged out successfully" });
});
exports.default = router;
