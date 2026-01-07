"use strict";
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
router.get("/", async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || typeof q !== "string") {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required"
            });
        }
        console.log('[Search] Query:', q);
        const { db } = await (0, database_1.connectToDatabase)();
        const currentUserId = getCurrentUserId(req);
        // First, check total users in database
        const totalUsers = await user_1.default.countDocuments();
        console.log('[Search] Total users in database:', totalUsers);
        // Search users with simpler query
        const users = await user_1.default.find({
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
            const userIds = users.map((u) => new mongodb_1.ObjectId(u._id));
            const follows = await db.collection('follows').find({
                followerId: new mongodb_1.ObjectId(currentUserId),
                followingId: { $in: userIds }
            }).toArray();
            follows.forEach((follow) => {
                followStatusMap[follow.followingId.toString()] = true;
            });
        }
        // Search posts
        const posts = await post_1.default.find({
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
        const formattedUsers = users.map((u) => ({
            _id: u._id.toString(),
            id: u._id.toString(),
            username: u.username,
            fullName: u.full_name,
            name: u.full_name,
            avatar: u.avatar_url,
            verified: u.is_verified,
            followers: u.followers_count || 0,
            bio: u.bio || '',
            isFollowing: followStatusMap[u._id.toString()] || false
        }));
        const formattedPosts = posts.map((p) => ({
            id: p._id.toString(),
            user: {
                id: p.user_id._id.toString(),
                username: p.user_id.username,
                avatar: p.user_id.avatar_url,
                verified: p.user_id.is_verified
            },
            content: p.caption || p.description || '',
            image: p.media_urls?.[0],
            likes: p.likes_count || 0,
            comments: p.comments_count || 0,
            shares: p.shares_count || 0,
            timestamp: p.created_at,
            liked: false,
            bookmarked: false
        }));
        console.log('[Search] Returning:', {
            users: formattedUsers.length,
            posts: formattedPosts.length,
            hashtags: hashtags.length
        });
        // Return in format expected by mobile app
        res.json({
            users: formattedUsers,
            posts: formattedPosts,
            hashtags
        });
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
});
// Search users
router.get("/users", async (req, res) => {
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
});
// Search posts
router.get("/posts", async (req, res) => {
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
});
// Search hashtags
router.get("/hashtags", async (req, res) => {
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
});
// Get trending hashtags
router.get("/trending", async (req, res) => {
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
});
// Global search
router.get("/global", async (req, res) => {
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
});
exports.default = router;
