"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Define the story schema
const storySchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    media_url: {
        type: String,
        required: true
    },
    media_type: {
        type: String,
        enum: ['image', 'video'],
        required: true
    },
    caption: {
        type: String,
        maxlength: 500,
        default: null
    },
    location: {
        type: String,
        default: null
    },
    texts: {
        type: Array,
        default: []
    },
    stickers: {
        type: Array,
        default: []
    },
    filter: {
        type: String,
        default: 'none'
    },
    music: {
        type: mongoose_1.default.Schema.Types.Mixed,
        default: null
    },
    views_count: {
        type: Number,
        default: 0
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    // Close Friends 2.0 fields
    share_type: {
        type: String,
        enum: ['your-story', 'close-friends'],
        default: 'your-story'
    },
    is_close_friends: {
        type: Boolean,
        default: false
    },
    // Remix fields
    is_remix: {
        type: Boolean,
        default: false
    },
    original_story_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Story',
        default: null
    },
    original_creator_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    original_creator_username: {
        type: String,
        default: null
    },
    remix_changes: {
        texts: {
            type: Array,
            default: []
        },
        stickers: {
            type: Array,
            default: []
        },
        filter: {
            type: String,
            default: 'none'
        }
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    expires_at: {
        type: Date,
        required: true
    }
});
// Index for better query performance
storySchema.index({ user_id: 1, created_at: -1 });
storySchema.index({ expires_at: 1 });
storySchema.index({ created_at: -1 });
// Pre-save middleware to set expiration to 24 hours from creation
storySchema.pre('save', function (next) {
    if (this.isNew && !this.expires_at) {
        this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
    next();
});
// Method to check if story is expired
storySchema.methods.isExpired = function () {
    return new Date() > this.expires_at;
};
// Method to increment view count
storySchema.methods.incrementViews = function () {
    this.views_count += 1;
    return this.save();
};
// Create the model if it doesn't exist or get it if it does
const Story = mongoose_1.default.models.Story || mongoose_1.default.model('Story', storySchema);
exports.default = Story;
