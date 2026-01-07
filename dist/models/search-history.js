"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const searchHistorySchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    query: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['user', 'hashtag', 'general'],
        default: 'general'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});
// Compound index for efficient queries
searchHistorySchema.index({ user_id: 1, created_at: -1 });
// TTL index - auto-delete after 30 days
searchHistorySchema.index({ created_at: 1 }, { expireAfterSeconds: 2592000 });
const SearchHistory = mongoose_1.default.models.SearchHistory || mongoose_1.default.model('SearchHistory', searchHistorySchema);
exports.default = SearchHistory;
