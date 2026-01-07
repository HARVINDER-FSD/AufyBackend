"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const notificationSchema = new mongoose_1.default.Schema({
    recipient_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sender_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'mention', 'reply', 'story_like', 'story_reply', 'reel_like', 'reel_comment'],
        required: true
    },
    content_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        required: false
    },
    content_type: {
        type: String,
        enum: ['post', 'reel', 'story', 'comment'],
        required: false
    },
    message: {
        type: String,
        required: false
    },
    is_read: {
        type: Boolean,
        default: false,
        index: true
    },
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    }
});
// Compound index for efficient queries
notificationSchema.index({ recipient_id: 1, created_at: -1 });
notificationSchema.index({ recipient_id: 1, is_read: 1 });
const Notification = mongoose_1.default.models.Notification || mongoose_1.default.model('Notification', notificationSchema);
exports.default = Notification;
