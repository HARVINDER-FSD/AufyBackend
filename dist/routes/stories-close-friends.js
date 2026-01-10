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
const auth_1 = require("../middleware/auth");
const story_1 = __importDefault(require("../models/story"));
const close_friend_1 = __importDefault(require("../models/close-friend"));
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get close friends stories only
router.get('/close-friends', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        // Get user's close friends list
        const closeFriendDoc = yield close_friend_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        if (!closeFriendDoc || closeFriendDoc.close_friend_ids.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }
        // Get stories from close friends that are marked as close-friends only
        const stories = yield story_1.default.find({
            user_id: { $in: closeFriendDoc.close_friend_ids },
            is_close_friends: true,
            expires_at: { $gt: new Date() },
            is_deleted: false
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .sort({ created_at: -1 })
            .lean();
        const formattedStories = stories
            .filter((story) => story.user_id)
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
            views_count: story.views_count || 0,
            is_close_friends: true
        }));
        res.json({
            success: true,
            data: formattedStories
        });
    }
    catch (error) {
        console.error('Error fetching close friends stories:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch close friends stories'
        });
    }
}));
// Create remixed story for highlight
router.post('/:storyId/remix', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { storyId } = req.params;
        const { texts, stickers, filter } = req.body;
        // Get original story
        const originalStory = yield story_1.default.findById(storyId)
            .populate('user_id', 'username')
            .lean();
        if (!originalStory) {
            return res.status(404).json({
                success: false,
                error: 'Original story not found'
            });
        }
        // Check if user is close friend (can only remix close friends stories)
        const closeFriendDoc = yield close_friend_1.default.findOne({
            user_id: originalStory.user_id._id,
            close_friend_ids: new mongoose_1.default.Types.ObjectId(userId)
        });
        if (!closeFriendDoc && originalStory.user_id._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only remix stories from your close friends'
            });
        }
        // Create remixed story (doesn't expire, for highlights)
        const remixedStory = yield story_1.default.create({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            media_url: originalStory.media_url, // Same media (locked)
            media_type: originalStory.media_type,
            caption: null,
            texts: texts || [],
            stickers: stickers || [],
            filter: filter || 'none',
            music: null,
            is_remix: true,
            original_story_id: originalStory._id,
            original_creator_id: originalStory.user_id._id,
            original_creator_username: originalStory.user_id.username,
            remix_changes: {
                texts: texts || [],
                stickers: stickers || [],
                filter: filter || 'none'
            },
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (for highlights)
            is_deleted: false
        });
        res.status(201).json({
            success: true,
            data: { story: remixedStory },
            message: 'Story remixed successfully'
        });
    }
    catch (error) {
        console.error('Error remixing story:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to remix story'
        });
    }
}));
exports.default = router;
