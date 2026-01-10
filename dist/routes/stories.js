"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const database_1 = require("../lib/database");
const story_1 = __importDefault(require("../models/story"));
const auth_1 = require("../middleware/auth");
const mongoose_1 = __importDefault(require("mongoose"));
// Type the Story model properly
const Story = story_1.default;
const router = (0, express_1.Router)();
// Get stories feed - with privacy filtering
router.get("/", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const currentUserId = req.userId;
        // Get following list if user is authenticated
        let followingIds = [];
        if (currentUserId) {
            const { MongoClient, ObjectId } = require('mongodb');
            const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
            const client = yield MongoClient.connect(MONGODB_URI);
            const db = client.db();
            const follows = yield db.collection('follows').find({
                followerId: new ObjectId(currentUserId)
            }).toArray();
            followingIds = follows.map((f) => f.followingId.toString());
            yield client.close();
        }
        // Get active stories (not expired)
        const stories = yield Story.find({
            expires_at: { $gt: new Date() },
            is_deleted: false
        })
            .populate('user_id', 'username full_name avatar_url is_verified is_private')
            .sort({ created_at: -1 })
            .limit(50)
            .lean();
        // Apply privacy filter - STRICT MODE (only following + own)
        const filteredStories = stories.filter((story) => {
            if (!story.user_id)
                return false;
            const storyUserId = story.user_id._id.toString();
            // Always show own stories
            if (currentUserId && storyUserId === currentUserId)
                return true;
            // Show ONLY if following the user (Instagram behavior)
            if (followingIds.includes(storyUserId))
                return true;
            // Hide all other stories (including public accounts)
            return false;
        });
        // Format stories for frontend
        const formattedStories = filteredStories.map((story) => ({
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
}));
// Create story
router.post("/", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { media_url, media_type, caption, texts, stickers, filter, music } = req.body;
        const userId = req.userId;
        if (!media_url || !media_type) {
            return res.status(400).json({
                success: false,
                error: 'Media URL and type are required'
            });
        }
        const story = yield Story.create({
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
        const populatedStory = yield Story.findById(story._id)
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
}));
// Get single story by ID
router.get("/:storyId", auth_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        // Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(storyId)) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        const story = yield Story.findOne({
            _id: new mongoose_1.default.Types.ObjectId(storyId),
            expires_at: { $gt: new Date() },
            is_deleted: false
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .lean();
        if (!story) {
            return res.status(404).json({
                success: false,
                error: 'Story not found or has expired'
            });
        }
        // Format story for frontend
        const formattedStory = {
            id: story._id.toString(),
            user_id: story.user_id._id.toString(),
            username: story.user_id.username,
            full_name: story.user_id.full_name,
            avatar_url: story.user_id.avatar_url,
            is_verified: story.user_id.is_verified || false,
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
        };
        res.json({
            success: true,
            data: formattedStory
        });
    }
    catch (error) {
        console.error('Error fetching story:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch story'
        });
    }
}));
// Get user stories (active only)
router.get("/user/:userId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { userId } = req.params;
        const stories = yield Story.find({
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
}));
// Get ALL user stories (including expired) - for creating memories
router.get("/user/:userId/all", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { userId } = req.params;
        // Get ALL stories (including expired), sorted by newest first
        const stories = yield Story.find({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            is_deleted: false
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .sort({ created_at: -1 })
            .lean();
        res.json({
            success: true,
            data: {
                stories,
                total: stories.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching all user stories:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch all user stories'
        });
    }
}));
// Delete story
router.delete("/:storyId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = yield Story.findById(storyId);
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
        yield Story.findByIdAndUpdate(storyId, { is_deleted: true });
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
}));
// View story
router.post("/:storyId/view", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = yield Story.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        // Don't count view if viewer is the story owner
        if (story.user_id.toString() === userId) {
            return res.json({
                success: true,
                message: "Own story - view not counted",
                views_count: story.views_count || 0
            });
        }
        // Import StoryView model
        const StoryView = (yield Promise.resolve().then(() => __importStar(require('../models/story-view')))).default;
        // Create or update view record (upsert)
        yield StoryView.findOneAndUpdate({ story_id: new mongoose_1.default.Types.ObjectId(storyId), viewer_id: new mongoose_1.default.Types.ObjectId(userId) }, { viewed_at: new Date() }, { upsert: true, new: true });
        // Update view count (excluding owner)
        const viewCount = yield StoryView.countDocuments({
            story_id: new mongoose_1.default.Types.ObjectId(storyId),
            viewer_id: { $ne: new mongoose_1.default.Types.ObjectId(story.user_id) }
        });
        yield Story.findByIdAndUpdate(storyId, { views_count: viewCount });
        res.json({
            success: true,
            message: "Story viewed",
            views_count: viewCount
        });
    }
    catch (error) {
        console.error('Error viewing story:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to view story'
        });
    }
}));
// Get story viewers (detailed list)
router.get("/:storyId/viewers", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = yield Story.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        if (story.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only view your own story viewers'
            });
        }
        // Import StoryView model
        const StoryView = (yield Promise.resolve().then(() => __importStar(require('../models/story-view')))).default;
        // Get all viewers with user details
        const viewers = yield StoryView.find({ story_id: new mongoose_1.default.Types.ObjectId(storyId) })
            .populate('viewer_id', 'username full_name avatar_url is_verified')
            .sort({ viewed_at: -1 })
            .lean();
        const formattedViewers = viewers
            .filter((view) => view.viewer_id) // Filter out deleted users
            .map((view) => ({
            id: view.viewer_id._id.toString(),
            username: view.viewer_id.username,
            full_name: view.viewer_id.full_name,
            avatar_url: view.viewer_id.avatar_url,
            is_verified: view.viewer_id.is_verified || false,
            viewed_at: view.viewed_at
        }));
        res.json({
            success: true,
            data: {
                viewers: formattedViewers,
                total_views: formattedViewers.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching story viewers:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch story viewers'
        });
    }
}));
// Get story views count (backward compatibility)
router.get("/:storyId/views", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, database_1.connectToDatabase)();
        const { storyId } = req.params;
        const userId = req.userId;
        const story = yield Story.findById(storyId);
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
}));
exports.default = router;
