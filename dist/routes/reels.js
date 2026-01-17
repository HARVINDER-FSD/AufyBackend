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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reel_1 = require("../services/reel");
const comment_1 = require("../services/comment");
const auth_1 = require("../middleware/auth");
const content_filter_1 = require("../middleware/content-filter");
const router = (0, express_1.Router)();
// Get reels feed (discover)
router.get("/", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { page, limit, username } = req.query;
        // If username is provided, get that user's reels
        if (username) {
            console.log('[Reels Route] Getting reels for username:', username);
            // First, find the user by username
            const { MongoClient } = require('mongodb');
            const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
            const client = new MongoClient(MONGODB_URI);
            yield client.connect();
            const db = client.db();
            const user = yield db.collection('users').findOne({ username });
            yield client.close();
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            console.log('[Reels Route] Found user:', user.username, 'ID:', user._id.toString());
            // Get reels for this specific user
            const currentUserId = req.userId || ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id);
            const result = yield reel_1.ReelService.getUserReels(user._id.toString(), currentUserId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
            console.log('[Reels Route] Returning', result.data.length, 'reels for user', username);
            return res.json(result);
        }
        // Use req.userId which is set by optionalAuth middleware
        const currentUserId = req.userId || ((_e = (_d = req.user) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString()) || ((_f = req.user) === null || _f === void 0 ? void 0 : _f.id);
        console.log('[Reels Route] Auth debug:', {
            hasToken: !!req.headers.authorization,
            userId: req.userId,
            userIdFromUser: (_h = (_g = req.user) === null || _g === void 0 ? void 0 : _g._id) === null || _h === void 0 ? void 0 : _h.toString(),
            finalUserId: currentUserId
        });
        const result = yield reel_1.ReelService.getReelsFeed(currentUserId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get user's liked reels
router.get("/liked", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let userId = req.userId;
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { getDatabase } = require('../lib/database');
        const { ObjectId } = require('mongodb');
        const db = yield getDatabase();
        console.log('[Reels/Liked] Raw userId:', userId, 'Type:', typeof userId);
        // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
        let userObjectId;
        try {
            userObjectId = new ObjectId(userId);
            console.log('[Reels/Liked] Converted to ObjectId:', userObjectId.toString());
        }
        catch (err) {
            console.error('[Reels/Liked] Failed to convert userId to ObjectId:', err);
            return res.json({
                success: true,
                reels: [],
                pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            });
        }
        console.log('[Reels/Liked] Using userObjectId:', userObjectId.toString());
        // Get total count of liked reels
        const total = yield db.collection('reel_likes').countDocuments({
            user_id: userObjectId
        });
        console.log('[Reels/Liked] Total liked reels:', total);
        // Get liked reels with full details
        const likedReels = yield db.collection('reel_likes')
            .aggregate([
            { $match: { user_id: userObjectId } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'reels',
                    localField: 'reel_id',
                    foreignField: '_id',
                    as: 'reel'
                }
            },
            { $unwind: { path: '$reel', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'reel.user_id',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: '$reel._id',
                    videoUrl: '$reel.video_url',
                    thumbnail: '$reel.thumbnail_url',
                    title: '$reel.title',
                    description: '$reel.description',
                    duration: '$reel.duration',
                    createdAt: '$reel.created_at',
                    likesCount: '$reel.likes_count',
                    viewsCount: '$reel.views_count',
                    commentsCount: '$reel.comments_count',
                    sharesCount: '$reel.shares_count',
                    author: {
                        _id: '$author._id',
                        username: '$author.username',
                        avatar: '$author.avatar'
                    }
                }
            },
            { $match: { _id: { $ne: null } } }
        ]).toArray();
        console.log('[Reels/Liked] Found liked reels:', likedReels.length);
        res.json({
            success: true,
            reels: likedReels,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
    }
    catch (error) {
        console.error('[Reels/Liked] Error:', error);
        // Return empty results on error instead of 500
        res.json({
            success: true,
            reels: [],
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false
            }
        });
    }
}));
// Get user's reels
router.get("/user/:userId", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { userId } = req.params;
        const { page, limit } = req.query;
        // Use req.userId which is set by optionalAuth middleware
        const currentUserId = req.userId || ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id);
        const result = yield reel_1.ReelService.getUserReels(userId, currentUserId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Create reel
router.post("/", auth_1.authenticateToken, content_filter_1.validateAgeAndContent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { video_url, thumbnail_url, title, description, duration } = req.body;
        const reel = yield reel_1.ReelService.createReel(req.userId, {
            video_url,
            thumbnail_url,
            title,
            description,
            duration,
        });
        res.status(201).json({
            success: true,
            data: { reel },
            message: "Reel created successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get reel by ID
router.get("/:reelId", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { reelId } = req.params;
        const reel = yield reel_1.ReelService.getReelById(reelId, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        res.json({
            success: true,
            data: { reel },
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Delete reel
router.delete("/:reelId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        yield reel_1.ReelService.deleteReel(reelId, req.userId);
        res.json({
            success: true,
            message: "Reel deleted successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Toggle like reel (like/unlike)
router.post("/:reelId/like", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        // Check if already liked, then toggle
        const result = yield reel_1.ReelService.toggleLikeReel(req.userId, reelId);
        res.json({
            success: true,
            liked: result.liked,
            likes: result.likes,
            message: result.liked ? "Reel liked successfully" : "Reel unliked successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Unlike reel (legacy endpoint)
router.delete("/:reelId/like", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        yield reel_1.ReelService.unlikeReel(req.userId, reelId);
        res.json({
            success: true,
            message: "Reel unliked successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Share reel (track share count)
router.post("/:reelId/share", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        yield reel_1.ReelService.incrementShareCount(reelId);
        res.json({
            success: true,
            message: "Share tracked successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get reel likes
router.get("/:reelId/likes", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        const { page, limit } = req.query;
        const result = yield reel_1.ReelService.getReelLikes(reelId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get reel comments
router.get("/:reelId/comments", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        const { page, limit, sort } = req.query;
        const result = yield comment_1.CommentService.getPostComments(reelId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20, sort || "newest");
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Create reel comment
router.post("/:reelId/comments", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reelId } = req.params;
        const { content, parent_comment_id } = req.body;
        const comment = yield comment_1.CommentService.createComment(req.userId, reelId, {
            content,
            parent_comment_id,
        });
        res.status(201).json({
            success: true,
            data: { comment },
            message: "Comment created successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
exports.default = router;
