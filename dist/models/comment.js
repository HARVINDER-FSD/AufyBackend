"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Define the comment schema
const commentSchema = new mongoose_1.default.Schema({
    post_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 2200
    },
    parent_comment_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    likes_count: {
        type: Number,
        default: 0
    },
    replies_count: {
        type: Number,
        default: 0
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});
// Index for better query performance
commentSchema.index({ post_id: 1, created_at: -1 });
commentSchema.index({ user_id: 1 });
commentSchema.index({ parent_comment_id: 1 });
// Pre-save middleware to update the updated_at field
commentSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});
// Create the model if it doesn't exist or get it if it does
const Comment = mongoose_1.default.models.Comment || mongoose_1.default.model('Comment', commentSchema);
exports.default = Comment;
