"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const highlightSchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: true,
        maxlength: 50,
    },
    cover_image: {
        type: String,
        required: true,
    },
    stories: [{
            story_id: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'Story',
            },
            is_remix: {
                type: Boolean,
                default: false,
            },
            original_creator: {
                id: mongoose_1.default.Schema.Types.ObjectId,
                username: String,
                avatar: String,
            },
            added_at: {
                type: Date,
                default: Date.now,
            },
        }],
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
});
// Indexes
highlightSchema.index({ user_id: 1, created_at: -1 });
exports.default = mongoose_1.default.model('Highlight', highlightSchema);
