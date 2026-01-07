"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const post_1 = require("../services/post");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user's personalized feed
router.get("/", auth_1.authenticateToken, async (req, res) => {
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
exports.default = router;
