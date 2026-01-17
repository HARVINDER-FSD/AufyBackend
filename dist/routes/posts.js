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
const post_1 = require("../services/post");
const comment_1 = require("../services/comment");
const auth_1 = require("../middleware/auth");
const database_1 = require("../lib/database");
const mongodb_1 = require("mongodb");
const redis_1 = require("../lib/redis");
const validate_1 = require("../middleware/validate");
const pagination_1 = require("../middleware/pagination");
const queue_1 = require("../lib/queue");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Schemas
const createPostSchema = joi_1.default.object({
    content: joi_1.default.string().max(2000).required(),
    media_urls: joi_1.default.array().items(joi_1.default.string().uri()).max(10).optional(),
    media_type: joi_1.default.string().valid('image', 'video', 'text', 'carousel').default('text'),
    location: joi_1.default.object({
        name: joi_1.default.string().allow(''),
        lat: joi_1.default.number(),
        lng: joi_1.default.number()
    }).optional()
});
const updatePostSchema = joi_1.default.object({
    content: joi_1.default.string().max(2000).optional(),
    location: joi_1.default.object({
        name: joi_1.default.string().allow(''),
        lat: joi_1.default.number(),
        lng: joi_1.default.number()
    }).optional()
});
const postReactionSchema = joi_1.default.object({
    reaction: joi_1.default.string().max(50).optional()
});
const createCommentSchema = joi_1.default.object({
    content: joi_1.default.string().max(1000).required(),
    parent_comment_id: joi_1.default.string().regex(/^[0-9a-fA-F]{24}$/).optional()
});
// Get user feed
router.get("/feed", auth_1.authenticateToken, pagination_1.paginate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit } = req.pagination; // Use req.pagination
        const pageNum = page || 1;
        const limitNum = limit || 20;
        // Try cache first
        const cacheKey = `feed:${req.userId}:${pageNum}:${limitNum}`;
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for feed page ${pageNum}`);
            return res.json(cached);
        }
        const result = yield post_1.PostService.getFeedPosts(req.userId, pageNum, limitNum);
        // Cache for 2 minutes
        yield (0, redis_1.cacheSet)(cacheKey, result, 120);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Create post
router.post("/", auth_1.authenticateToken, (0, validate_1.validateBody)(createPostSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content, media_urls, media_type, location } = req.body;
        // Use req.userId instead of req.user.userId
        const post = yield post_1.PostService.createPost(req.userId, {
            content,
            media_urls,
            media_type,
            location,
        });
        // Invalidate local caches
        yield (0, redis_1.cacheInvalidate)(`feed:${req.userId}:*`);
        yield (0, redis_1.cacheInvalidate)(`user_posts:${req.userId}:*`);
        // Trigger background feed update for followers
        yield (0, queue_1.addJob)(queue_1.QUEUE_NAMES.FEED_UPDATES, 'post-created', {
            userId: req.userId,
            type: 'new_post'
        });
        res.status(201).json({
            success: true,
            data: { post },
            message: "Post created successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get post by ID
router.get("/:postId", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { postId } = req.params;
        const post = yield post_1.PostService.getPostById(postId, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        res.json({
            success: true,
            data: { post },
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Update post
router.put("/:postId", auth_1.authenticateToken, (0, validate_1.validateBody)(updatePostSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const updates = req.body;
        const post = yield post_1.PostService.updatePost(postId, req.userId, updates);
        res.json({
            success: true,
            data: { post },
            message: "Post updated successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Delete post
router.delete("/:postId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        yield post_1.PostService.deletePost(postId, req.userId);
        res.json({
            success: true,
            message: "Post deleted successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Like post (toggle behavior with reactions)
router.post("/:postId/like", auth_1.authenticateToken, (0, validate_1.validateBody)(postReactionSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const { reaction } = req.body; // Get reaction from request body
        const userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        const likesCollection = db.collection('likes');
        // Check if already liked
        const existingLike = yield likesCollection.findOne({
            user_id: new mongodb_1.ObjectId(userId),
            post_id: new mongodb_1.ObjectId(postId)
        });
        let isLiked;
        let userReaction = null;
        if (existingLike && !reaction) {
            // Unlike - delete the like (only if no reaction provided)
            yield likesCollection.deleteOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(postId)
            });
            isLiked = false;
            // Delete like notification
            try {
                const { deleteLikeNotification } = require('../lib/notifications');
                const post = yield db.collection('posts').findOne({ _id: new mongodb_1.ObjectId(postId) });
                if (post && post.user_id) {
                    yield deleteLikeNotification(post.user_id.toString(), userId, postId);
                }
            }
            catch (err) {
                console.error('[LIKE] Notification deletion error:', err);
            }
        }
        else if (existingLike && reaction) {
            // Update existing like with new reaction
            yield likesCollection.updateOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(postId)
            }, {
                $set: {
                    reaction: reaction,
                    updated_at: new Date()
                }
            });
            isLiked = true;
            userReaction = reaction;
        }
        else {
            // Like - insert new like with reaction
            yield likesCollection.insertOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(postId),
                reaction: reaction || '❤️', // Default to heart if no reaction specified
                created_at: new Date()
            });
            isLiked = true;
            userReaction = reaction || '❤️';
            // Create like notification via Background Queue
            try {
                const post = yield db.collection('posts').findOne({ _id: new mongodb_1.ObjectId(postId) });
                if (post && post.user_id && post.user_id.toString() !== userId) {
                    // Fetch sender username for the notification body
                    const sender = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
                    yield (0, queue_1.addJob)(queue_1.QUEUE_NAMES.NOTIFICATIONS, 'like-notification', {
                        recipientId: post.user_id.toString(),
                        title: 'New Like! ❤️',
                        body: `${(sender === null || sender === void 0 ? void 0 : sender.username) || 'Someone'} liked your post.`,
                        data: { postId, type: 'like' }
                    });
                }
            }
            catch (err) {
                console.error('[LIKE] Queue error:', err);
            }
        }
        // Get updated like count
        const likeCount = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(postId) });
        // Get users who liked (for "liked by" display)
        const recentLikes = yield likesCollection.aggregate([
            { $match: { post_id: new mongodb_1.ObjectId(postId) } },
            { $sort: { created_at: -1 } },
            { $limit: 3 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            { $project: { 'user.username': 1 } }
        ]).toArray();
        const likedBy = recentLikes.map((like) => like.user.username);
        // Get reaction summary (count of each reaction type)
        const reactionSummary = yield likesCollection.aggregate([
            { $match: { post_id: new mongodb_1.ObjectId(postId) } },
            {
                $group: {
                    _id: '$reaction',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        // Convert to object format: { "❤️": 10, "😍": 5, ... }
        const reactions = {};
        reactionSummary.forEach((item) => {
            if (item._id) {
                reactions[item._id] = item.count;
            }
        });
        res.json({
            success: true,
            liked: isLiked,
            likeCount,
            likedBy,
            reaction: userReaction, // User's current reaction
            reactions, // Summary of all reactions on this post
            message: isLiked ? "Post liked successfully" : "Post unliked successfully",
        });
    }
    catch (error) {
        console.error('Like error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Unlike post
router.delete("/:postId/like", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        yield post_1.PostService.unlikePost(req.userId, postId);
        res.json({
            success: true,
            message: "Post unliked successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get post likes
router.get("/:postId/likes", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const { page, limit } = req.query;
        const result = yield post_1.PostService.getPostLikes(postId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Share post (track share count)
router.post("/:postId/share", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        const sharesCollection = db.collection('shares');
        // Check if already shared
        const existingShare = yield sharesCollection.findOne({
            user_id: new mongodb_1.ObjectId(userId),
            post_id: new mongodb_1.ObjectId(postId)
        });
        if (existingShare) {
            return res.json({
                success: true,
                message: "Post already shared",
                shared: true
            });
        }
        // Record the share
        yield sharesCollection.insertOne({
            user_id: new mongodb_1.ObjectId(userId),
            post_id: new mongodb_1.ObjectId(postId),
            created_at: new Date()
        });
        // Get updated share count
        const shareCount = yield sharesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(postId) });
        res.json({
            success: true,
            message: "Post shared successfully",
            shared: true,
            shareCount
        });
    }
    catch (error) {
        console.error('Share error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Get post comments
router.get("/:postId/comments", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const { page, limit, sort } = req.query;
        const result = yield comment_1.CommentService.getPostComments(postId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20, sort || "newest");
        res.json(result);
    }
    catch (error) {
        console.error('[COMMENTS] Error fetching comments:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message || 'Failed to fetch comments',
            data: [], // Return empty array as fallback
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
            }
        });
    }
}));
// Create comment
router.post("/:postId/comments", auth_1.authenticateToken, (0, validate_1.validateBody)(createCommentSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const { content, parent_comment_id } = req.body;
        const comment = yield comment_1.CommentService.createComment(req.userId, postId, {
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
        console.error('[COMMENT CREATE] Error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message || 'Failed to create comment',
        });
    }
}));
exports.default = router;
