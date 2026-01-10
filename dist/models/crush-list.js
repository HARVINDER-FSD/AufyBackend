"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const crushListSchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    crush_ids: [{
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
crushListSchema.index({ user_id: 1, crush_ids: 1 });
exports.default = mongoose_1.default.model('CrushList', crushListSchema);
