"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reel_1 = require("../services/reel");
const comment_1 = require("../services/comment");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get reels feed (discover)
router.get("/", auth_1.optionalAuth, async (req, res) => {
    try {
        const { page, limit } = req.query;
        const result = await reel_1.ReelService.getReelsFeed(req.user?.userId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get user's reels
router.get("/user/:userId", auth_1.optionalAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page, limit } = req.query;
        const result = await reel_1.ReelService.getUserReels(userId, req.user?.userId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Create reel
router.post("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const { video_url, thumbnail_url, title, description, duration } = req.body;
        const reel = await reel_1.ReelService.createReel(req.userId, {
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
});
// Get reel by ID
router.get("/:reelId", auth_1.optionalAuth, async (req, res) => {
    try {
        const { reelId } = req.params;
        const reel = await reel_1.ReelService.getReelById(reelId, req.user?.userId);
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
});
// Delete reel
router.delete("/:reelId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { reelId } = req.params;
        await reel_1.ReelService.deleteReel(reelId, req.userId);
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
});
// Like reel
router.post("/:reelId/like", auth_1.authenticateToken, async (req, res) => {
    try {
        const { reelId } = req.params;
        await reel_1.ReelService.likeReel(req.userId, reelId);
        res.json({
            success: true,
            message: "Reel liked successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Unlike reel
router.delete("/:reelId/like", auth_1.authenticateToken, async (req, res) => {
    try {
        const { reelId } = req.params;
        await reel_1.ReelService.unlikeReel(req.userId, reelId);
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
});
// Get reel likes
router.get("/:reelId/likes", auth_1.optionalAuth, async (req, res) => {
    try {
        const { reelId } = req.params;
        const { page, limit } = req.query;
        const result = await reel_1.ReelService.getReelLikes(reelId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get reel comments
router.get("/:reelId/comments", auth_1.optionalAuth, async (req, res) => {
    try {
        const { reelId } = req.params;
        const { page, limit, sort } = req.query;
        const result = await comment_1.CommentService.getPostComments(reelId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20, sort || "newest");
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Create reel comment
router.post("/:reelId/comments", auth_1.authenticateToken, async (req, res) => {
    try {
        const { reelId } = req.params;
        const { content, parent_comment_id } = req.body;
        const comment = await comment_1.CommentService.createComment(req.userId, reelId, {
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
