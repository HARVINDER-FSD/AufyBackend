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
const express_1 = require("express");
const database_1 = require("../lib/database");
const user_1 = __importDefault(require("../models/user"));
const post_1 = __importDefault(require("../models/post"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongodb_1 = require("mongodb");
const redis_1 = require("../lib/redis");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';
// Helper to get current user ID from token (optional)
const getCurrentUserId = (req) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token)
            return null;
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded.userId;
    }
    catch (error) {
        return null;
    }
};
// Global search (root endpoint)
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || typeof q !== "string") {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required"
            });
        }
        console.log('[Search] Query:', q);
        // Try cache first
        const cacheKey = `search:${q}:${limit}`;
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for search: ${q}`);
            return res.json(cached);
        }
        const { db } = yield (0, database_1.connectToDatabase)();
        const currentUserId = getCurrentUserId(req);
        // First, check total users in database
        const totalUsers = yield user_1.default.countDocuments();
        console.log('[Search] Total users in database:', totalUsers);
        // Search users with simpler query
        const users = yield user_1.default.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { full_name: { $regex: q, $options: 'i' } }
            ]
        })
            .select('username full_name avatar_url is_verified followers_count is_active')
            .limit(Number(limit))
            .lean();
        console.log('[Search] Found users:', users.length);
        if (users.length > 0) {
            console.log('[Search] First user:', users[0]);
        }
        // Check follow status for each user if logged in
        let followStatusMap = {};
        if (currentUserId && users.length > 0) {
            console.log('[Search] Checking follow status for currentUserId:', currentUserId);
            const userIds = users.map((u) => new mongodb_1.ObjectId(u._id));
            console.log('[Search] User IDs to check:', userIds.map(id => id.toString()));
            const follows = yield db.collection('follows').find({
                follower_id: new mongodb_1.ObjectId(currentUserId), // Fixed: use follower_id instead of followerId
                following_id: { $in: userIds } // Fixed: use following_id instead of followingId
            }).toArray();
            console.log('[Search] Found follows:', follows.length);
            follows.forEach((follow) => {
                const followingIdStr = follow.following_id.toString(); // Fixed: use following_id
                followStatusMap[followingIdStr] = true;
                console.log('[Search] User', followingIdStr, 'is followed');
            });
        }
        // Search posts
        const posts = yield post_1.default.find({
            $or: [
                { caption: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ]
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .limit(Number(limit))
            .lean();
        // Extract hashtags from query
        const hashtags = q.startsWith('#') ? [{ tag: q, posts: 0 }] : [];
        const formattedUsers = users.map((u) => {
            const userId = u._id.toString();
            const isFollowing = followStatusMap[userId] || false;
            console.log('[Search] Formatting user:', u.username, 'ID:', userId, 'isFollowing:', isFollowing);
            return {
                _id: userId,
                id: userId,
                username: u.username,
                fullName: u.full_name,
                name: u.full_name,
                avatar: u.avatar_url,
                verified: u.is_verified,
                followers: u.followers_count || 0,
                bio: u.bio || '',
                isFollowing: isFollowing
            };
        });
        const formattedPosts = posts.map((p) => {
            var _a;
            return ({
                id: p._id.toString(),
                user: {
                    id: p.user_id._id.toString(),
                    username: p.user_id.username,
                    avatar: p.user_id.avatar_url,
                    verified: p.user_id.is_verified
                },
                content: p.caption || p.description || '',
                image: (_a = p.media_urls) === null || _a === void 0 ? void 0 : _a[0],
                likes: p.likes_count || 0,
                comments: p.comments_count || 0,
                shares: p.shares_count || 0,
                timestamp: p.created_at,
                liked: false,
                bookmarked: false
            });
        });
        console.log('[Search] Returning:', {
            users: formattedUsers.length,
            posts: formattedPosts.length,
            hashtags: hashtags.length
        });
        // Return in format expected by mobile app
        const response = {
            users: formattedUsers,
            posts: formattedPosts,
            hashtags
        };
        // Cache for 10 minutes (600 seconds)
        yield (0, redis_1.cacheSet)(cacheKey, response, 600);
        res.json(response);
    }
    catch (error) {
        console.error("❌ Error performing search:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: error.message
        });
    }
}));
// Search users
router.get("/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        if (!q || typeof q !== "string") {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required"
            });
        }
        // Placeholder response - implement with actual search service
        res.json({
            success: true,
            data: {
                users: [],
                total: 0
            }
        });
    }
    catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}));
// Search posts
router.get("/posts", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        if (!q || typeof q !== "string") {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required"
            });
        }
        res.json({
            success: true,
            data: {
                posts: [],
                total: 0
            }
        });
    }
    catch (error) {
        console.error("Error searching posts:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}));
// Search hashtags
router.get("/hashtags", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        if (!q || typeof q !== "string") {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required"
            });
        }
        res.json({
            success: true,
            data: {
                hashtags: [],
                total: 0
            }
        });
    }
    catch (error) {
        console.error("Error searching hashtags:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}));
// Get trending hashtags
router.get("/trending", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { limit = 10 } = req.query;
        res.json({
            success: true,
            data: {
                hashtags: [],
                total: 0
            }
        });
    }
    catch (error) {
        console.error("Error getting trending hashtags:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}));
// Global search
router.get("/global", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || typeof q !== "string") {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required"
            });
        }
        res.json({
            success: true,
            data: {
                users: [],
                posts: [],
                hashtags: [],
                total: 0
            }
        });
    }
    catch (error) {
        console.error("Error performing global search:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}));
exports.default = router;
