"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../lib/database");
const story_1 = __importDefault(require("../models/story"));
const auth_1 = require("../middleware/auth");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get stories feed - optional auth
router.get("/", auth_1.optionalAuth, async (req, res) => {
    try {
        await (0, database_1.connectToDatabase)();
        // Get active stories (not expired)
        const stories = await story_1.default.find({
            expires_at: { $gt: new Date() },
            is_deleted: false
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .sort({ created_at: -1 })
            .limit(50)
            .lean();
        // Format stories for frontend (filter out stories with deleted users)
        const formattedStories = stories
            .filter((story) => story.user_id) // Only include stories with valid users
            .map((story) => ({
            id: story._id.toString(),
            user_id: story.user_id._id.toString(),
            username: story.user_id.username,
            full_name: story.user_id.full_name,
            avatar_url: story.user_id.avatar_url,
            is_verified: story.user_id.is_verified,
            media_url: story.media_url,
            media_type: story.media_type,
            caption: story.caption,
            created_at: story.created_at,
            expires_at: story.expires_at,
            texts: story.texts || [],
            stickers: story.stickers || [],
            filter: story.filter || 'none',
            music: story.music || null,
            views_count: story.views_count || 0
        }));
        res.json({
            success: true,
            data: formattedStories
        });
    }
    catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch stories'
        });
    }
});
// Create story
router.post("/", auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, database_1.connectToDatabase)();
        const { media_url, media_type, caption, texts, stickers, filter, music } = req.body;
        const userId = req.userId;
        if (!media_url || !media_type) {
            return res.status(400).json({
                success: false,
                error: 'Media URL and type are required'
            });
        }
        const story = await story_1.default.create({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            media_url,
            media_type,
            caption: caption || null,
            texts: texts || [],
            stickers: stickers || [],
            filter: filter || 'none',
            music: music || null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        const populatedStory = await story_1.default.findById(story._id)
            .populate('user_id', 'username full_name avatar_url is_verified')
            .lean();
        res.status(201).json({
            success: true,
            data: { story: populatedStory },
            message: "Story created successfully"
        });
    }
    catch (error) {
        console.error('Error creating story:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create story'
        });
    }
});
// Get user stories
router.get("/user/:userId", async (req, res) => {
    try {
        await (0, database_1.connectToDatabase)();
        const { userId } = req.params;
        const stories = await story_1.default.find({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            expires_at: { $gt: new Date() },
            is_deleted: false
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .sort({ created_at: -1 })
            .lean();
        res.json({
            success: true,
            data: { stories }
        });
    }
    catch (error) {
        console.error('Error fetching user stories:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user stories'
        });
    }
});
// Delete story
router.delete("/:storyId", auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = await story_1.default.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        if (story.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only delete your own stories'
            });
        }
        await story_1.default.findByIdAndUpdate(storyId, { is_deleted: true });
        res.json({
            success: true,
            message: "Story deleted successfully"
        });
    }
    catch (error) {
        console.error('Error deleting story:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete story'
        });
    }
});
// View story
router.post("/:storyId/view", auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = await story_1.default.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        // Increment view count
        await story_1.default.findByIdAndUpdate(storyId, {
            $inc: { views_count: 1 }
        });
        res.json({
            success: true,
            message: "Story viewed"
        });
    }
    catch (error) {
        console.error('Error viewing story:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to view story'
        });
    }
});
// Get story views
router.get("/:storyId/views", auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = await story_1.default.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        if (story.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only view your own story views'
            });
        }
        res.json({
            success: true,
            data: {
                views: story.views_count || 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching story views:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch story views'
        });
    }
});
exports.default = router;
