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
exports.CommentService = void 0;
const database_1 = require("../lib/database");
const utils_1 = require("../lib/utils");
const anonymous_utils_1 = require("../lib/anonymous-utils");
const config_1 = require("../lib/config");
const comment_1 = __importDefault(require("../models/comment"));
const post_1 = __importDefault(require("../models/post"));
const user_1 = __importDefault(require("../models/user"));
// Type assertions to fix Mongoose model type issues
const Comment = comment_1.default;
const Post = post_1.default;
const User = user_1.default;
class CommentService {
    // Create comment
    static createComment(userId, postId, commentData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { content, parent_comment_id } = commentData;
                console.log('[COMMENT CREATE] Starting:', { userId, postId, content: content === null || content === void 0 ? void 0 : content.substring(0, 50) });
                // Validate content
                if (!content || content.trim().length === 0) {
                    throw new Error("Comment content is required");
                }
                if (content.length > 2200) {
                    throw new Error("Comment too long (max 2200 characters)");
                }
                // Check if post exists
                console.log('[COMMENT CREATE] Checking if post exists...');
                const postExists = yield Post.findById(postId).lean().exec();
                if (!postExists) {
                    throw new Error("Post not found");
                }
                console.log('[COMMENT CREATE] Post found');
                // Check if parent comment exists (if provided)
                if (parent_comment_id) {
                    console.log('[COMMENT CREATE] Checking parent comment...');
                    const parentExists = yield Comment.findById(parent_comment_id).lean().exec();
                    if (!parentExists) {
                        throw new Error("Parent comment not found");
                    }
                }
                // Get user data
                console.log('[COMMENT CREATE] Fetching user data...');
                const user = yield User.findById(userId)
                    .select('username full_name avatar_url is_verified badge_type isAnonymousMode anonymousPersona')
                    .lean()
                    .exec();
                if (!user) {
                    throw utils_1.errors.notFound('User not found');
                }
                // Create comment
                console.log('[COMMENT CREATE] Creating comment...');
                const newComment = yield Comment.create({
                    user_id: userId,
                    post_id: postId,
                    parent_comment_id: parent_comment_id || null,
                    content: content.trim(),
                    is_deleted: false,
                    is_anonymous: user.isAnonymousMode === true,
                    likes_count: 0,
                    replies_count: 0,
                });
                console.log('[COMMENT CREATE] Comment created:', newComment._id);
                const comment = {
                    id: newComment._id.toString(),
                    _id: newComment._id,
                    user_id: newComment.user_id,
                    post_id: newComment.post_id,
                    content: newComment.content,
                    parent_comment_id: newComment.parent_comment_id,
                    likes_count: newComment.likes_count || 0,
                    replies_count: newComment.replies_count || 0,
                    is_deleted: newComment.is_deleted,
                    created_at: newComment.created_at,
                    updated_at: newComment.updated_at,
                    user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: newComment.is_anonymous }))
                };
                console.log('[COMMENT CREATE] Success!');
                return comment;
            }
            catch (error) {
                console.error('[COMMENT CREATE] Error:', error);
                throw error;
            }
        });
    }
    // Get post comments
    static getPostComments(postId_1) {
        return __awaiter(this, arguments, void 0, function* (postId, page = 1, limit = 20, sortBy = "newest") {
            // Validate and sanitize pagination params
            const validPage = Math.max(1, Math.floor(page));
            const validLimit = Math.min(100, Math.max(1, Math.floor(limit)));
            const offset = (validPage - 1) * validLimit;
            const sortOrder = sortBy === "newest" ? -1 : 1;
            const total = yield Comment.countDocuments({
                post_id: postId,
                parent_comment_id: null,
                is_deleted: false
            }).exec();
            const comments = yield Comment.find({
                post_id: postId,
                parent_comment_id: null,
                is_deleted: false
            })
                .sort({ created_at: sortOrder })
                .skip(offset)
                .limit(validLimit)
                .lean()
                .exec();
            // Get users for main comments
            const userIds = comments.map((c) => c.user_id);
            const users = yield User.find({ _id: { $in: userIds } })
                .select('id username full_name avatar_url is_verified badge_type')
                .lean()
                .exec();
            // Get all comment IDs to fetch replies in batch
            const commentIds = comments.map((c) => c._id);
            // Fetch all replies for these comments in one query
            const allReplies = yield Comment.find({
                parent_comment_id: { $in: commentIds },
                is_deleted: false
            })
                .sort({ created_at: 1 })
                .lean()
                .exec();
            // Get all user IDs from replies
            const replyUserIds = [...new Set(allReplies.map((r) => r.user_id.toString()))];
            const replyUsers = yield User.find({ _id: { $in: replyUserIds } })
                .select('id username full_name avatar_url is_verified badge_type')
                .lean()
                .exec();
            const commentsWithData = comments.map((comment) => {
                const user = users.find((u) => u._id.toString() === comment.user_id.toString());
                // Filter replies for this comment (limit to 3 per comment as before)
                const commentReplies = allReplies
                    .filter((r) => r.parent_comment_id.toString() === comment._id.toString())
                    .slice(0, 3);
                const repliesWithUsers = commentReplies.map((reply) => {
                    const replyUser = replyUsers.find((u) => u._id.toString() === reply.user_id.toString());
                    return Object.assign(Object.assign({}, reply), { user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, replyUser), { is_anonymous: reply.is_anonymous })) });
                });
                return Object.assign(Object.assign({}, comment), { user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: comment.is_anonymous })), replies: repliesWithUsers });
            });
            const totalPages = Math.ceil(total / validLimit);
            return {
                success: true,
                data: commentsWithData,
                pagination: {
                    page: validPage,
                    limit: validLimit,
                    total,
                    totalPages,
                    hasNext: validPage < totalPages,
                    hasPrev: validPage > 1,
                },
            };
        });
    }
    // Get comment replies
    static getCommentReplies(commentId_1) {
        return __awaiter(this, arguments, void 0, function* (commentId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const total = yield Comment.countDocuments({
                parent_comment_id: commentId,
                is_deleted: false
            }).exec();
            const replies = yield Comment.find({
                parent_comment_id: commentId,
                is_deleted: false
            })
                .sort({ created_at: 1 })
                .skip(offset)
                .limit(validLimit)
                .lean()
                .exec();
            const userIds = replies.map((r) => r.user_id);
            const users = yield User.find({ _id: { $in: userIds }, is_active: true })
                .select('id username full_name avatar_url is_verified')
                .lean()
                .exec();
            const repliesWithUsers = replies.map((reply) => {
                const user = users.find((u) => u._id.toString() === reply.user_id.toString());
                return Object.assign(Object.assign({}, reply), { user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: reply.is_anonymous })) });
            });
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: repliesWithUsers,
                pagination: paginationMeta,
            };
        });
    }
    // Update comment
    static updateComment(commentId, userId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!content || content.trim().length === 0) {
                throw utils_1.errors.badRequest("Comment content is required");
            }
            if (content.length > 1000) {
                throw utils_1.errors.badRequest("Comment too long (max 1000 characters)");
            }
            const comment = yield Comment.findOneAndUpdate({
                _id: commentId,
                user_id: userId,
                is_deleted: false
            }, {
                content: content.trim(),
                updated_at: new Date()
            }, { new: true }).lean().exec();
            if (!comment) {
                throw utils_1.errors.notFound("Comment not found or you don't have permission to update it");
            }
            // Get user data
            const user = yield User.findById(userId)
                .select('id username full_name avatar_url is_verified')
                .lean()
                .exec();
            const updatedComment = Object.assign(Object.assign({}, comment), { user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: comment.is_anonymous })) });
            // Clear comments cache
            yield database_1.cache.del(utils_1.cacheKeys.postComments(comment.post_id));
            return updatedComment;
        });
    }
    // Delete comment
    static deleteComment(commentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // First, check if comment exists
            const comment = yield Comment.findById(commentId).lean().exec();
            if (!comment) {
                throw utils_1.errors.notFound("Comment not found");
            }
            // Check if already deleted
            if (comment.is_deleted) {
                throw utils_1.errors.notFound("Comment has already been deleted");
            }
            // Verify ownership - only the comment owner can delete it
            if (comment.user_id.toString() !== userId) {
                throw utils_1.errors.forbidden("You don't have permission to delete this comment. Only the comment owner can delete it.");
            }
            // Soft delete the comment
            const result = yield Comment.updateOne({
                _id: commentId,
                user_id: userId,
                is_deleted: false
            }, {
                is_deleted: true
            }).exec();
            if (result.matchedCount === 0) {
                throw utils_1.errors.notFound("Failed to delete comment");
            }
            // Update cached post comment count
            const cachedPost = yield database_1.cache.get(utils_1.cacheKeys.post(comment.post_id));
            if (cachedPost) {
                cachedPost.comments_count = Math.max(0, (cachedPost.comments_count || 0) - 1);
                yield database_1.cache.set(utils_1.cacheKeys.post(comment.post_id), cachedPost, config_1.config.redis.ttl.post);
            }
            // Clear comments cache
            yield database_1.cache.del(utils_1.cacheKeys.postComments(comment.post_id));
        });
    }
    // Get comment by ID
    static getCommentById(commentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const comment = yield Comment.findOne({
                _id: commentId,
                is_deleted: false
            }).lean().exec();
            if (!comment) {
                throw utils_1.errors.notFound("Comment not found");
            }
            const user = yield User.findOne({
                _id: comment.user_id,
                is_active: true
            })
                .select('id username full_name avatar_url is_verified')
                .lean()
                .exec();
            if (!user) {
                throw utils_1.errors.notFound("Comment user not found");
            }
            return Object.assign(Object.assign({}, comment), { user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: comment.is_anonymous })) });
        });
    }
}
exports.CommentService = CommentService;
