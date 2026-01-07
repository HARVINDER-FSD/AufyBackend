"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const reportSchema = new mongoose_1.default.Schema({
    reporter_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    reported_user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    content_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        required: false
    },
    content_type: {
        type: String,
        enum: ['post', 'reel', 'story', 'comment', 'user'],
        required: false
    },
    reason: {
        type: String,
        enum: ['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'false_info', 'other'],
        required: true
    },
    description: {
        type: String,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'action_taken', 'dismissed'],
        default: 'pending',
        index: true
    },
    reviewed_by: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    reviewed_at: {
        type: Date,
        required: false
    },
    action_taken: {
        type: String,
        required: false
    },
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    }
});
// Compound indexes
reportSchema.index({ status: 1, created_at: -1 });
reportSchema.index({ content_id: 1, content_type: 1 });
const Report = mongoose_1.default.models.Report || mongoose_1.default.model('Report', reportSchema);
exports.default = Report;
