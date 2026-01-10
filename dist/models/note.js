"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const noteSchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: 60,
    },
    note_type: {
        type: String,
        enum: ['text', 'photo', 'music'],
        default: 'text',
    },
    photo_url: {
        type: String,
        default: null,
    },
    music_title: {
        type: String,
        default: null,
    },
    music_artist: {
        type: String,
        default: null,
    },
    music_preview_url: {
        type: String,
        default: null,
    },
    music_artwork_url: {
        type: String,
        default: null,
    },
    emoji: {
        type: String,
        default: null,
    },
    text_color: {
        type: String,
        default: '#FFFFFF',
    },
    background_style: {
        type: String,
        enum: ['solid', 'gradient', 'transparent'],
        default: 'solid',
    },
    background_color: {
        type: String,
        default: '#6366f1',
    },
    gradient_colors: {
        start: String,
        end: String,
    },
    emotion: {
        type: String,
        enum: ['happy', 'sad', 'excited', 'tired', 'love', 'thinking', 'chill', 'hungry', 'custom'],
        default: 'custom',
    },
    visibility: {
        type: String,
        enum: ['everyone', 'close-friends', 'groups', 'favorite', 'custom'],
        default: 'everyone',
    },
    group_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
    },
    favorite_user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    hidden_from: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User',
        }],
    reactions: [{
            user_id: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User',
            },
            emoji: String,
            created_at: {
                type: Date,
                default: Date.now,
            },
        }],
    created_at: {
        type: Date,
        default: Date.now,
    },
    expires_at: {
        type: Date,
        required: true,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
});
// Indexes for performance
noteSchema.index({ user_id: 1, is_active: 1 });
noteSchema.index({ expires_at: 1 });
noteSchema.index({ created_at: -1 });
// Pre-save middleware to set expiration
noteSchema.pre('save', function (next) {
    if (this.isNew && !this.expires_at) {
        this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
    next();
});
// Method to check if note is expired
noteSchema.methods.isExpired = function () {
    return new Date() > this.expires_at;
};
// Method to add reaction
noteSchema.methods.addReaction = function (userId, emoji) {
    // Remove existing reaction from this user
    this.reactions = this.reactions.filter((r) => r.user_id.toString() !== userId);
    // Add new reaction
    this.reactions.push({
        user_id: new mongoose_1.default.Types.ObjectId(userId),
        emoji,
        created_at: new Date(),
    });
    return this.save();
};
// Method to remove reaction
noteSchema.methods.removeReaction = function (userId) {
    this.reactions = this.reactions.filter((r) => r.user_id.toString() !== userId);
    return this.save();
};
exports.default = mongoose_1.default.model('Note', noteSchema);
