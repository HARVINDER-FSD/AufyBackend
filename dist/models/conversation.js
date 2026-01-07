"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Define the conversation schema
const conversationSchema = new mongoose_1.default.Schema({
    participants: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }],
    type: {
        type: String,
        enum: ['direct', 'group'],
        default: 'direct'
    },
    name: {
        type: String,
        default: null // For group conversations
    },
    description: {
        type: String,
        default: null // For group conversations
    },
    created_by: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
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
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updated_at: -1 });
// Pre-save middleware to update the updated_at field
conversationSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});
// Method to check if user is participant
conversationSchema.methods.isParticipant = function (userId) {
    return this.participants.some((participant) => participant.toString() === userId.toString());
};
// Method to get other participants (excluding the given user)
conversationSchema.methods.getOtherParticipants = function (userId) {
    return this.participants.filter((participant) => participant.toString() !== userId.toString());
};
// Create the model if it doesn't exist or get it if it does
const Conversation = mongoose_1.default.models.Conversation || mongoose_1.default.model('Conversation', conversationSchema);
exports.default = Conversation;
