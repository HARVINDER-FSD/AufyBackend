"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const closeFriendSchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    close_friend_ids: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User',
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
// Index for faster queries
closeFriendSchema.index({ user_id: 1, close_friend_ids: 1 });
exports.default = mongoose_1.default.model('CloseFriend', closeFriendSchema);
