"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const blockedUserSchema = new mongoose_1.default.Schema({
    blocker_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    blocked_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});
// Compound index for efficient queries
blockedUserSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });
const BlockedUser = mongoose_1.default.models.BlockedUser || mongoose_1.default.model('BlockedUser', blockedUserSchema);
exports.default = BlockedUser;
