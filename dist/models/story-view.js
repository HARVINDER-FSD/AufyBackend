"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Story View Schema - Track who viewed each story
const storyViewSchema = new mongoose_1.default.Schema({
    story_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Story',
        required: true
    },
    viewer_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    viewed_at: {
        type: Date,
        default: Date.now
    }
});
// Compound index to prevent duplicate views and improve query performance
storyViewSchema.index({ story_id: 1, viewer_id: 1 }, { unique: true });
storyViewSchema.index({ story_id: 1, viewed_at: -1 });
storyViewSchema.index({ viewer_id: 1, viewed_at: -1 });
// TTL index - auto-delete views after 30 days
storyViewSchema.index({ viewed_at: 1 }, { expireAfterSeconds: 2592000 });
const StoryView = mongoose_1.default.models.StoryView || mongoose_1.default.model('StoryView', storyViewSchema);
exports.default = StoryView;
