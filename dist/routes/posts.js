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
const content_filter_1 = require("../middleware/content-filter");
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
router.post("/", auth_1.authenticateToken, content_filter_1.validateAgeAndContent, (0, validate_1.validateBody)(createPostSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
router.put("/:postId", auth_1.authenticateToken, content_filter_1.validateAgeAndContent, (0, validate_1.validateBody)(updatePostSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        let userObjectId;
        let postObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            postObjectId = new mongodb_1.ObjectId(postId);
        }
        catch (err) {
            console.error('[LIKE] ObjectId conversion error:', err);
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }
        const db = yield (0, database_1.getDatabase)();
        const likesCollection = db.collection('likes');
        const existingLike = yield likesCollection.findOne({
            user_id: userObjectId,
            post_id: postObjectId
        });
        let isLiked;
        let userReaction = null;
        if (existingLike && !reaction) {
            yield likesCollection.deleteOne({
                user_id: userObjectId,
                post_id: postObjectId
            });
            isLiked = false;
            try {
                const { deleteLikeNotification } = require('../lib/notifications');
                const post = yield db.collection('posts').findOne({ _id: postObjectId });
                if (post && post.user_id) {
                    yield deleteLikeNotification(post.user_id.toString(), userId, postId);
                }
            }
            catch (err) {
                console.error('[LIKE] Notification deletion error:', err);
            }
        }
        else if (existingLike && reaction) {
            yield likesCollection.updateOne({
                user_id: userObjectId,
                post_id: postObjectId
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
            const user = yield db.collection('users').findOne({ _id: userObjectId });
            const isAnonymous = (user === null || user === void 0 ? void 0 : user.isAnonymousMode) === true;
            yield likesCollection.insertOne({
                user_id: userObjectId,
                post_id: postObjectId,
                reaction: reaction || '❤️',
                is_anonymous: isAnonymous,
                created_at: new Date()
            });
            isLiked = true;
            userReaction = reaction || '❤️';
            try {
                const post = yield db.collection('posts').findOne({ _id: postObjectId });
                if (post && post.user_id && post.user_id.toString() !== userId) {
                    const sender = yield db.collection('users').findOne({ _id: userObjectId });
                    yield (0, queue_1.addJob)(queue_1.QUEUE_NAMES.NOTIFICATIONS, 'like-notification', {
                        recipientId: post.user_id.toString(),
                        title: 'New Like! ❤️',
                        body: isAnonymous ? 'A Ghost User 👻 liked your post.' : `${(sender === null || sender === void 0 ? void 0 : sender.username) || 'Someone'} liked your post.`,
                        data: { postId, type: 'like' }
                    });
                }
            }
            catch (err) {
                console.error('[LIKE] Queue error:', err);
            }
        }
        const likeCount = yield likesCollection.countDocuments({ post_id: postObjectId });
        const recentLikes = yield likesCollection.aggregate([
            { $match: { post_id: postObjectId } },
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
            { $project: { 'user.username': 1, 'is_anonymous': 1 } }
        ]).toArray();
        const likedBy = recentLikes.map((like) => like.is_anonymous ? 'Ghost User' : like.user.username);
        const reactionSummary = yield likesCollection.aggregate([
            { $match: { post_id: postObjectId } },
            {
                $group: {
                    _id: '$reaction',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
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
// Get user's liked posts
router.get("/liked", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let userId = req.userId;
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const db = yield (0, database_1.getDatabase)();
        console.log('[Posts/Liked] Raw userId:', userId, 'Type:', typeof userId);
        // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
        let userObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            console.log('[Posts/Liked] Converted to ObjectId:', userObjectId.toString());
        }
        catch (err) {
            console.error('[Posts/Liked] Failed to convert userId to ObjectId:', err);
            return res.json({
                success: true,
                posts: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                }
            });
        }
        const likesFilter = {
            $or: [
                { user_id: userObjectId },
                { user_id: userId }
            ]
        };
        const total = yield db.collection('likes').countDocuments(likesFilter);
        console.log('[Posts/Liked] Total liked posts:', total);
        const likedPosts = yield db.collection('likes')
            .aggregate([
            { $match: likesFilter },
            {
                $addFields: {
                    normalizedPostId: {
                        $cond: [
                            { $eq: [{ $type: '$post_id' }, 'objectId'] },
                            '$post_id',
                            {
                                $convert: {
                                    input: '$post_id',
                                    to: 'objectId',
                                    onError: null,
                                    onNull: null
                                }
                            }
                        ]
                    }
                }
            },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'normalizedPostId',
                    foreignField: '_id',
                    as: 'post'
                }
            },
            { $unwind: { path: '$post', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'post.user_id',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: '$post._id',
                    content: '$post.content',
                    media_urls: '$post.media_urls',
                    media_type: '$post.media_type',
                    createdAt: '$post.created_at',
                    likesCount: '$post.likes_count',
                    commentsCount: '$post.comments_count',
                    sharesCount: '$post.shares_count',
                    author: {
                        _id: '$author._id',
                        username: '$author.username',
                        avatar: '$author.avatar'
                    }
                }
            },
            { $match: { _id: { $ne: null } } }
        ]).toArray();
        console.log('[Posts/Liked] Found liked posts:', likedPosts.length);
        res.json({
            success: true,
            endpoint: '/api/posts/liked',
            version: 2,
            posts: likedPosts,
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
        console.error('[Posts/Liked] Error:', error);
        res.json({
            success: true,
            endpoint: '/api/posts/liked',
            version: 2,
            posts: [],
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
// Get user's saved posts
router.get("/saved", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let userId = req.userId;
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const db = yield (0, database_1.getDatabase)();
        console.log('[Posts/Saved] Raw userId:', userId, 'Type:', typeof userId);
        // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
        let userObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            console.log('[Posts/Saved] Converted to ObjectId:', userObjectId.toString());
        }
        catch (err) {
            console.error('[Posts/Saved] Failed to convert userId to ObjectId:', err);
            return res.json({
                success: true,
                posts: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                }
            });
        }
        console.log('[Posts/Saved] Using userObjectId:', userObjectId.toString());
        // Debug: Check all bookmarks in collection
        try {
            const allBookmarks = yield db.collection('bookmarks').find({}).limit(5).toArray();
            console.log('[Posts/Saved] Sample bookmarks in collection:', allBookmarks.map(b => {
                var _a, _b, _c, _d;
                return ({
                    user_id: ((_b = (_a = b.user_id) === null || _a === void 0 ? void 0 : _a.toString) === null || _b === void 0 ? void 0 : _b.call(_a)) || b.user_id,
                    post_id: ((_d = (_c = b.post_id) === null || _c === void 0 ? void 0 : _c.toString) === null || _d === void 0 ? void 0 : _d.call(_c)) || b.post_id,
                    created_at: b.created_at
                });
            }));
        }
        catch (debugErr) {
            console.log('[Posts/Saved] Could not fetch sample bookmarks:', debugErr);
        }
        // Get total count of saved posts
        let total = 0;
        try {
            total = yield db.collection('bookmarks').countDocuments({
                user_id: userObjectId
            });
        }
        catch (countErr) {
            console.log('[Posts/Saved] Bookmarks collection may not exist yet, returning empty');
            total = 0;
        }
        console.log('[Posts/Saved] Total saved posts:', total);
        // Get saved posts with full details
        let savedPosts = [];
        if (total > 0) {
            try {
                savedPosts = yield db.collection('bookmarks')
                    .aggregate([
                    { $match: { user_id: userObjectId } },
                    { $sort: { created_at: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'posts',
                            localField: 'post_id',
                            foreignField: '_id',
                            as: 'post'
                        }
                    },
                    { $unwind: { path: '$post', preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'post.user_id',
                            foreignField: '_id',
                            as: 'author'
                        }
                    },
                    { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: '$post._id',
                            content: '$post.content',
                            media_urls: '$post.media_urls',
                            media_type: '$post.media_type',
                            createdAt: '$post.created_at',
                            likesCount: '$post.likes_count',
                            commentsCount: '$post.comments_count',
                            sharesCount: '$post.shares_count',
                            author: {
                                _id: '$author._id',
                                username: '$author.username',
                                avatar: '$author.avatar'
                            }
                        }
                    },
                    { $match: { _id: { $ne: null } } }
                ]).toArray();
            }
            catch (aggErr) {
                console.error('[Posts/Saved] Aggregation error:', aggErr);
                savedPosts = [];
            }
        }
        console.log('[Posts/Saved] Found saved posts:', savedPosts.length);
        res.json({
            success: true,
            posts: savedPosts,
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
        console.error('[Posts/Saved] Error:', error);
        // Return empty results on error instead of 500
        res.json({
            success: true,
            posts: [],
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
        let userObjectId;
        let postObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            postObjectId = new mongodb_1.ObjectId(postId);
        }
        catch (err) {
            console.error('[SHARE] ObjectId conversion error:', err);
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }
        const db = yield (0, database_1.getDatabase)();
        const sharesCollection = db.collection('shares');
        const existingShare = yield sharesCollection.findOne({
            user_id: userObjectId,
            post_id: postObjectId
        });
        if (existingShare) {
            return res.json({
                success: true,
                message: "Post already shared",
                shared: true
            });
        }
        yield sharesCollection.insertOne({
            user_id: userObjectId,
            post_id: postObjectId,
            created_at: new Date()
        });
        const shareCount = yield sharesCollection.countDocuments({ post_id: postObjectId });
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
// Bookmark post (toggle behavior)
router.post("/:postId/bookmark", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        const bookmarksCollection = db.collection('bookmarks');
        console.log('[Bookmark] userId:', userId, 'postId:', postId);
        // Convert to ObjectId
        let userObjectId;
        let postObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            postObjectId = new mongodb_1.ObjectId(postId);
            console.log('[Bookmark] Converted - userObjectId:', userObjectId.toString(), 'postObjectId:', postObjectId.toString());
        }
        catch (err) {
            console.error('[Bookmark] ObjectId conversion error:', err);
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }
        // Check if already bookmarked
        const existingBookmark = yield bookmarksCollection.findOne({
            user_id: userObjectId,
            post_id: postObjectId
        });
        console.log('[Bookmark] Existing bookmark:', existingBookmark ? 'Found' : 'Not found');
        let isBookmarked;
        if (existingBookmark) {
            // Remove bookmark
            yield bookmarksCollection.deleteOne({
                user_id: userObjectId,
                post_id: postObjectId
            });
            isBookmarked = false;
            console.log('[Bookmark] Removed bookmark');
        }
        else {
            // Add bookmark
            const result = yield bookmarksCollection.insertOne({
                user_id: userObjectId,
                post_id: postObjectId,
                created_at: new Date()
            });
            isBookmarked = true;
            console.log('[Bookmark] Added bookmark, insertedId:', result.insertedId);
        }
        // Get updated bookmark count
        const bookmarkCount = yield bookmarksCollection.countDocuments({ post_id: postObjectId });
        console.log('[Bookmark] Total bookmarks for this post:', bookmarkCount);
        res.json({
            success: true,
            bookmarked: isBookmarked,
            bookmarkCount,
            message: isBookmarked ? "Post bookmarked successfully" : "Post removed from bookmarks"
        });
    }
    catch (error) {
        console.error('[Bookmark] Error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Check if post is bookmarked
router.get("/:postId/bookmark", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const userId = req.userId;
        let userObjectId = null;
        let postObjectId;
        try {
            postObjectId = new mongodb_1.ObjectId(postId);
            if (userId) {
                userObjectId = new mongodb_1.ObjectId(userId);
            }
        }
        catch (err) {
            console.error('[BOOKMARK CHECK] ObjectId conversion error:', err);
            return res.json({
                success: true,
                bookmarked: false,
                bookmarkCount: 0
            });
        }
        const db = yield (0, database_1.getDatabase)();
        const bookmarksCollection = db.collection('bookmarks');
        let isBookmarked = false;
        let bookmarkCount = 0;
        if (userObjectId) {
            const bookmark = yield bookmarksCollection.findOne({
                user_id: userObjectId,
                post_id: postObjectId
            });
            isBookmarked = !!bookmark;
        }
        bookmarkCount = yield bookmarksCollection.countDocuments({ post_id: postObjectId });
        res.json({
            success: true,
            bookmarked: isBookmarked,
            bookmarkCount
        });
    }
    catch (error) {
        console.error('Check bookmark error:', error);
        res.json({
            success: true,
            bookmarked: false,
            bookmarkCount: 0
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
router.post("/:postId/comments", auth_1.authenticateToken, content_filter_1.validateAgeAndContent, (0, validate_1.validateBody)(createCommentSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
