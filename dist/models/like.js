"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Define the like schema
const likeSchema = new mongoose_1.default.Schema({
    post_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        refPath: 'content_type',
        required: true
    },
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content_type: {
        type: String,
        enum: ['Post', 'Reel', 'Comment'],
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});
// Compound index to ensure a user can only like a post once
likeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });
likeSchema.index({ user_id: 1, created_at: -1 });
likeSchema.index({ post_id: 1, created_at: -1 });
// Create the model if it doesn't exist or get it if it does
const Like = mongoose_1.default.models.Like || mongoose_1.default.model('Like', likeSchema);
exports.default = Like;
