"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const post_1 = require("../services/post");
const comment_1 = require("../services/comment");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user feed
router.get("/feed", auth_1.authenticateToken, async (req, res) => {
    try {
        const { page, limit } = req.query;
        const result = await post_1.PostService.getFeedPosts(req.userId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Create post
router.post("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const { content, media_urls, media_type, location } = req.body;
        // Use req.userId instead of req.user.userId
        const post = await post_1.PostService.createPost(req.userId, {
            content,
            media_urls,
            media_type,
            location,
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
});
// Get post by ID
router.get("/:postId", auth_1.optionalAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await post_1.PostService.getPostById(postId, req.user?.userId);
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
});
// Update post
router.put("/:postId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const updates = req.body;
        const post = await post_1.PostService.updatePost(postId, req.userId, updates);
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
});
// Delete post
router.delete("/:postId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        await post_1.PostService.deletePost(postId, req.userId);
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
});
// Like post
router.post("/:postId/like", auth_1.authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        await post_1.PostService.likePost(req.userId, postId);
        res.json({
            success: true,
            message: "Post liked successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Unlike post
router.delete("/:postId/like", auth_1.authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        await post_1.PostService.unlikePost(req.userId, postId);
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
});
// Get post likes
router.get("/:postId/likes", auth_1.optionalAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        const { page, limit } = req.query;
        const result = await post_1.PostService.getPostLikes(postId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get post comments
router.get("/:postId/comments", auth_1.optionalAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        const { page, limit, sort } = req.query;
        const result = await comment_1.CommentService.getPostComments(postId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20, sort || "newest");
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Create comment
router.post("/:postId/comments", auth_1.authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parent_comment_id } = req.body;
        const comment = await comment_1.CommentService.createComment(req.userId, postId, {
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
});
exports.default = router;
