"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const paymentTransactionSchema = new mongoose_1.default.Schema({
    user_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    subscription_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ['INR', 'USD'],
        default: 'INR',
    },
    payment_method: {
        type: String,
        required: true,
    },
    payment_gateway: {
        type: String,
        enum: ['razorpay', 'stripe', 'paypal'],
        required: true,
    },
    transaction_id: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending',
    },
    payment_date: {
        type: Date,
        default: Date.now,
    },
    invoice_number: {
        type: String,
        default: null,
    },
    metadata: {
        type: mongoose_1.default.Schema.Types.Mixed,
        default: {},
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});
// Indexes
paymentTransactionSchema.index({ user_id: 1, created_at: -1 });
paymentTransactionSchema.index({ transaction_id: 1 });
paymentTransactionSchema.index({ status: 1 });
exports.default = mongoose_1.default.model('PaymentTransaction', paymentTransactionSchema);
