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
const highlight_1 = __importDefault(require("../models/highlight"));
const story_1 = __importDefault(require("../models/story"));
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get user's highlights
router.get('/user/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const highlights = yield highlight_1.default.find({ user_id: new mongoose_1.default.Types.ObjectId(userId) })
            .sort({ created_at: -1 })
            .lean();
        res.json({
            success: true,
            data: { highlights }
        });
    }
    catch (error) {
        console.error('Error fetching highlights:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch highlights'
        });
    }
}));
// Get highlight details with stories
router.get('/:highlightId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { highlightId } = req.params;
        const highlight = yield highlight_1.default.findById(highlightId).lean();
        if (!highlight) {
            return res.status(404).json({
                success: false,
                error: 'Highlight not found'
            });
        }
        // Fetch all stories in the highlight
        const storyIds = highlight.stories.map((s) => s.story_id);
        const stories = yield story_1.default.find({ _id: { $in: storyIds } })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .lean();
        // Merge story data with highlight metadata
        const enrichedStories = highlight.stories.map((hs) => {
            const story = stories.find((s) => s._id.toString() === hs.story_id.toString());
            return Object.assign(Object.assign({}, story), { is_remix: hs.is_remix, original_creator: hs.original_creator, added_at: hs.added_at });
        });
        res.json({
            success: true,
            data: {
                highlight: Object.assign(Object.assign({}, highlight), { stories: enrichedStories })
            }
        });
    }
    catch (error) {
        console.error('Error fetching highlight:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch highlight'
        });
    }
}));
// Create new highlight
router.post('/', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { title, cover_image } = req.body;
        if (!title || !cover_image) {
            return res.status(400).json({
                success: false,
                error: 'Title and cover image are required'
            });
        }
        const highlight = yield highlight_1.default.create({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            title,
            cover_image,
            stories: []
        });
        res.status(201).json({
            success: true,
            data: { highlight },
            message: 'Highlight created successfully'
        });
    }
    catch (error) {
        console.error('Error creating highlight:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create highlight'
        });
    }
}));
// Add story to highlight (with remix support)
router.post('/:highlightId/add-story', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { highlightId } = req.params;
        const { story_id, is_remix, original_creator } = req.body;
        const highlight = yield highlight_1.default.findById(highlightId);
        if (!highlight) {
            return res.status(404).json({
                success: false,
                error: 'Highlight not found'
            });
        }
        // Check ownership
        if (highlight.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only add stories to your own highlights'
            });
        }
        // Check if story already in highlight
        const alreadyExists = highlight.stories.some((s) => s.story_id.toString() === story_id);
        if (alreadyExists) {
            return res.status(400).json({
                success: false,
                error: 'Story already in highlight'
            });
        }
        // Add story
        highlight.stories.push({
            story_id: new mongoose_1.default.Types.ObjectId(story_id),
            is_remix: is_remix || false,
            original_creator: original_creator || null,
            added_at: new Date()
        });
        highlight.updated_at = new Date();
        yield highlight.save();
        res.json({
            success: true,
            message: 'Story added to highlight',
            data: { highlight }
        });
    }
    catch (error) {
        console.error('Error adding story to highlight:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add story to highlight'
        });
    }
}));
// Remove story from highlight
router.delete('/:highlightId/remove-story/:storyId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { highlightId, storyId } = req.params;
        const highlight = yield highlight_1.default.findById(highlightId);
        if (!highlight) {
            return res.status(404).json({
                success: false,
                error: 'Highlight not found'
            });
        }
        // Check ownership
        if (highlight.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only remove stories from your own highlights'
            });
        }
        const filteredStories = highlight.stories.filter((s) => s.story_id.toString() !== storyId);
        highlight.stories = filteredStories;
        highlight.updated_at = new Date();
        yield highlight.save();
        res.json({
            success: true,
            message: 'Story removed from highlight'
        });
    }
    catch (error) {
        console.error('Error removing story from highlight:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to remove story from highlight'
        });
    }
}));
// Delete highlight
router.delete('/:highlightId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { highlightId } = req.params;
        const highlight = yield highlight_1.default.findById(highlightId);
        if (!highlight) {
            return res.status(404).json({
                success: false,
                error: 'Highlight not found'
            });
        }
        // Check ownership
        if (highlight.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only delete your own highlights'
            });
        }
        yield highlight_1.default.findByIdAndDelete(highlightId);
        res.json({
            success: true,
            message: 'Highlight deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting highlight:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete highlight'
        });
    }
}));
exports.default = router;
