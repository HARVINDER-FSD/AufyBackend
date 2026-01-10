"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const subscriptionSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    razorpaySubscriptionId: {
        type: String,
        required: true,
        unique: true,
    },
    razorpayPlanId: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['created', 'active', 'paused', 'cancelled', 'expired'],
        default: 'created',
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    autoRenew: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});
const Subscription = mongoose_1.default.models.Subscription || mongoose_1.default.model('Subscription', subscriptionSchema);
exports.default = Subscription;
