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
const note_1 = __importDefault(require("../models/note"));
const close_friend_1 = __importDefault(require("../models/close-friend"));
const crush_list_1 = __importDefault(require("../models/crush-list"));
const mongoose_1 = __importDefault(require("mongoose"));
const content_filter_1 = require("../middleware/content-filter");
const router = (0, express_1.Router)();
// Health check for notes endpoint
router.get('/health', (_req, res) => {
    res.json({ success: true, message: 'Notes API is working' });
});
// Get active notes from friends and crush list
router.get('/', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        // Initialize arrays
        let friendIds = [];
        let closeFriendIds = [];
        let crushIds = [];
        try {
            // Get user's friends (following)
            const db = mongoose_1.default.connection.db;
            if (db) {
                const followsCollection = db.collection('follows');
                const follows = yield followsCollection.find({ follower_id: new mongoose_1.default.Types.ObjectId(userId) }).toArray();
                friendIds = (follows === null || follows === void 0 ? void 0 : follows.map((f) => f.following_id)) || [];
            }
        }
        catch (err) {
            console.log('Could not fetch follows:', err);
        }
        try {
            // Get close friends
            const closeFriends = yield close_friend_1.default.find({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
            closeFriendIds = closeFriends.map((cf) => cf.friend_id);
        }
        catch (err) {
            console.log('Could not fetch close friends:', err);
        }
        try {
            // Get crush list (favorites)
            const crushList = yield crush_list_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
            crushIds = (crushList === null || crushList === void 0 ? void 0 : crushList.crush_ids) || [];
        }
        catch (err) {
            console.log('Could not fetch crush list:', err);
        }
        // Build query for visible notes - simplified to avoid errors
        const orConditions = [
            // User's own notes
            { user_id: new mongoose_1.default.Types.ObjectId(userId) }
        ];
        // Add conditions only if we have data
        if (friendIds.length > 0) {
            orConditions.push({ visibility: 'everyone', user_id: { $in: friendIds } });
        }
        if (closeFriendIds.length > 0) {
            orConditions.push({ visibility: 'close-friends', user_id: { $in: closeFriendIds } });
        }
        if (friendIds.length > 0 || crushIds.length > 0) {
            orConditions.push({ visibility: 'custom', user_id: { $in: [...friendIds, ...crushIds] } });
        }
        // Favorite visibility
        orConditions.push({ visibility: 'favorite', favorite_user_id: new mongoose_1.default.Types.ObjectId(userId) });
        const notesQuery = {
            is_active: true,
            expires_at: { $gt: new Date() },
            $or: orConditions
        };
        // Get active notes
        const notes = yield note_1.default.find(notesQuery)
            .populate('user_id', 'username full_name avatar_url is_verified')
            .populate('favorite_user_id', 'username full_name avatar_url')
            .populate('reactions.user_id', 'username avatar_url')
            .sort({ created_at: -1 })
            .limit(50) // Limit results
            .lean();
        res.json({
            success: true,
            data: { notes: notes || [] }
        });
    }
    catch (error) {
        console.error('Error fetching notes:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch notes',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}));
// Get user's active note
router.get('/user/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const note = yield note_1.default.findOne({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            is_active: true,
            expires_at: { $gt: new Date() }
        })
            .populate('user_id', 'username full_name avatar_url is_verified')
            .populate('reactions.user_id', 'username avatar_url')
            .lean();
        res.json({
            success: true,
            data: { note }
        });
    }
    catch (error) {
        console.error('Error fetching user note:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user note'
        });
    }
}));
// Create new note
router.post('/', auth_1.authenticateToken, content_filter_1.validateAgeAndContent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { content, note_type, photo_url, music_title, music_artist, music_preview_url, music_artwork_url, emoji, text_color, background_style, background_color, gradient_colors, emotion, visibility, group_id, favorite_user_id, hidden_from } = req.body;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Content is required'
            });
        }
        if (content.length > 60) {
            return res.status(400).json({
                success: false,
                error: 'Content must be 60 characters or less'
            });
        }
        // Validate note type specific fields
        if (note_type === 'photo' && !photo_url) {
            return res.status(400).json({
                success: false,
                error: 'Photo URL is required for photo notes'
            });
        }
        if (note_type === 'music' && (!music_title || !music_artist)) {
            return res.status(400).json({
                success: false,
                error: 'Music title and artist are required for music notes'
            });
        }
        // Deactivate any existing active notes
        yield note_1.default.updateMany({ user_id: new mongoose_1.default.Types.ObjectId(userId), is_active: true }, { is_active: false });
        // Create new note
        const note = yield note_1.default.create({
            user_id: new mongoose_1.default.Types.ObjectId(userId),
            content: content.trim(),
            note_type: note_type || 'text',
            photo_url: photo_url || null,
            music_title: music_title || null,
            music_artist: music_artist || null,
            music_preview_url: music_preview_url || null,
            music_artwork_url: music_artwork_url || null,
            emoji: emoji || null,
            text_color: text_color || '#FFFFFF',
            background_style: background_style || 'solid',
            background_color: background_color || '#6366f1',
            gradient_colors: gradient_colors || null,
            emotion: emotion || 'custom',
            visibility: visibility || 'everyone',
            group_id: group_id ? new mongoose_1.default.Types.ObjectId(group_id) : null,
            favorite_user_id: favorite_user_id ? new mongoose_1.default.Types.ObjectId(favorite_user_id) : null,
            hidden_from: hidden_from || [],
            reactions: [],
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            is_active: true
        });
        const populatedNote = yield note_1.default.findById(note._id)
            .populate('user_id', 'username full_name avatar_url is_verified')
            .populate('favorite_user_id', 'username full_name avatar_url')
            .lean();
        res.status(201).json({
            success: true,
            data: { note: populatedNote },
            message: 'Note created successfully'
        });
    }
    catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create note'
        });
    }
}));
// Update note
router.put('/:noteId', auth_1.authenticateToken, content_filter_1.validateAgeAndContent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { noteId } = req.params;
        const updateData = req.body;
        const note = yield note_1.default.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Note not found'
            });
        }
        if (note.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only update your own notes'
            });
        }
        // Update allowed fields
        const allowedFields = [
            'content', 'emoji', 'text_color', 'background_style',
            'background_color', 'gradient_colors', 'emotion',
            'visibility', 'hidden_from'
        ];
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                note[field] = updateData[field];
            }
        });
        yield note.save();
        const populatedNote = yield note_1.default.findById(note._id)
            .populate('user_id', 'username full_name avatar_url is_verified')
            .populate('reactions.user_id', 'username avatar_url')
            .lean();
        res.json({
            success: true,
            data: { note: populatedNote },
            message: 'Note updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update note'
        });
    }
}));
// Delete note
router.delete('/:noteId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { noteId } = req.params;
        const note = yield note_1.default.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Note not found'
            });
        }
        if (note.user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only delete your own notes'
            });
        }
        note.is_active = false;
        yield note.save();
        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete note'
        });
    }
}));
// React to note
router.post('/:noteId/react', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { noteId } = req.params;
        const { emoji } = req.body;
        if (!emoji) {
            return res.status(400).json({
                success: false,
                error: 'Emoji is required'
            });
        }
        const note = yield note_1.default.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Note not found'
            });
        }
        // Add or update reaction
        yield note.addReaction(userId, emoji);
        const populatedNote = yield note_1.default.findById(note._id)
            .populate('user_id', 'username full_name avatar_url is_verified')
            .populate('reactions.user_id', 'username avatar_url')
            .lean();
        res.json({
            success: true,
            data: { note: populatedNote },
            message: 'Reaction added successfully'
        });
    }
    catch (error) {
        console.error('Error reacting to note:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to react to note'
        });
    }
}));
// Remove reaction from note
router.delete('/:noteId/react', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { noteId } = req.params;
        const note = yield note_1.default.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                error: 'Note not found'
            });
        }
        yield note.removeReaction(userId);
        const populatedNote = yield note_1.default.findById(note._id)
            .populate('user_id', 'username full_name avatar_url is_verified')
            .populate('reactions.user_id', 'username avatar_url')
            .lean();
        res.json({
            success: true,
            data: { note: populatedNote },
            message: 'Reaction removed successfully'
        });
    }
    catch (error) {
        console.error('Error removing reaction:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to remove reaction'
        });
    }
}));
exports.default = router;
