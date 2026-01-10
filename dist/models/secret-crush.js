"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretCrush = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SecretCrushSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    crushUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    isMutual: {
        type: Boolean,
        default: false,
        index: true
    },
    mutualChatId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    mutualDetectedAt: {
        type: Date,
        default: null
    },
    notifiedAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    removedAt: {
        type: Date,
        default: null
    },
    mutualBrokenAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true // This adds updatedAt automatically
});
// Compound unique index to prevent duplicate entries
SecretCrushSchema.index({ userId: 1, crushUserId: 1 }, { unique: true });
// Index for mutual detection queries
SecretCrushSchema.index({ crushUserId: 1, isActive: 1 });
// Index for listing user's crushes
SecretCrushSchema.index({ userId: 1, isMutual: 1, isActive: 1 });
// Prevent self-crush
SecretCrushSchema.pre('save', function (next) {
    if (this.userId.equals(this.crushUserId)) {
        next(new Error('Cannot add yourself as secret crush'));
    }
    next();
});
exports.SecretCrush = mongoose_1.default.model('SecretCrush', SecretCrushSchema);
