"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const conversationSchema = new mongoose_1.default.Schema({
    type: {
        type: String,
        enum: ['direct', 'group'],
        required: true,
        default: 'direct'
    },
    name: {
        type: String,
        trim: true
    },
    created_by: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    participants: [{
            user: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            role: {
                type: String,
                enum: ['admin', 'member'],
                default: 'member'
            },
            joined_at: {
                type: Date,
                default: Date.now
            },
            left_at: {
                type: Date
            }
        }],
    last_message: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Message'
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});
// Indexes
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ type: 1 });
const Conversation = mongoose_1.default.models.Conversation || mongoose_1.default.model('Conversation', conversationSchema);
exports.default = Conversation;
