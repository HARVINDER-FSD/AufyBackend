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
const auth_1 = require("../middleware/auth");
const database_1 = require("../lib/database");
const mongodb_1 = require("mongodb");
const router = (0, express_1.Router)();
// Get user's comments
router.get("/my-comments", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let userId = req.userId;
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const db = yield (0, database_1.getDatabase)();
        console.log('[Comments/MyComments] Raw userId:', userId, 'Type:', typeof userId);
        // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
        let userObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            console.log('[Comments/MyComments] Converted to ObjectId:', userObjectId.toString());
        }
        catch (err) {
            console.error('[Comments/MyComments] Failed to convert userId to ObjectId:', err);
            return res.json({
                success: true,
                comments: [],
                pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            });
        }
        console.log('[Comments/MyComments] Using userObjectId:', userObjectId.toString());
        // Get total count of user's comments
        const total = yield db.collection('comments').countDocuments({
            user_id: userObjectId
        });
        console.log('[Comments/MyComments] Total comments:', total);
        // Get user's comments with post/reel details
        const comments = yield db.collection('comments')
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
            {
                $lookup: {
                    from: 'reels',
                    localField: 'post_id',
                    foreignField: '_id',
                    as: 'reel'
                }
            },
            {
                $project: {
                    _id: 1,
                    text: '$content',
                    postId: '$post_id',
                    postTitle: {
                        $cond: [
                            { $gt: [{ $size: '$post' }, 0] },
                            { $substr: [{ $arrayElemAt: ['$post.content', 0] }, 0, 50] },
                            { $cond: [
                                    { $gt: [{ $size: '$reel' }, 0] },
                                    { $arrayElemAt: ['$reel.title', 0] },
                                    'Post'
                                ] }
                        ]
                    },
                    createdAt: '$created_at',
                    likesCount: { $ifNull: ['$likes_count', 0] }
                }
            }
        ]).toArray();
        console.log('[Comments/MyComments] Found comments:', comments.length);
        res.json({
            success: true,
            comments,
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
        console.error('[Comments/MyComments] Error:', error);
        // Return empty results on error instead of 500
        res.json({
            success: true,
            comments: [],
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
// Delete comment
router.delete("/:commentId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { commentId } = req.params;
        const db = yield (0, database_1.getDatabase)();
        // Check if comment belongs to user
        const comment = yield db.collection('comments').findOne({
            _id: new mongodb_1.ObjectId(commentId),
            user_id: new mongodb_1.ObjectId(userId)
        });
        if (!comment) {
            return res.status(404).json({
                success: false,
                error: 'Comment not found or you do not have permission to delete it'
            });
        }
        // Delete the comment
        yield db.collection('comments').deleteOne({
            _id: new mongodb_1.ObjectId(commentId)
        });
        // Decrement comment count on post/reel
        if (comment.post_id) {
            yield db.collection('posts').updateOne({ _id: new mongodb_1.ObjectId(comment.post_id) }, { $inc: { comments_count: -1 } });
            yield db.collection('reels').updateOne({ _id: new mongodb_1.ObjectId(comment.post_id) }, { $inc: { comments_count: -1 } });
        }
        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting comment:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
exports.default = router;
