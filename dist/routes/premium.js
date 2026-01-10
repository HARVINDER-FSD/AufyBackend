"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const database_1 = require("../lib/database");
const auth_1 = require("../middleware/auth");
const razorpay_1 = require("../services/razorpay");
const payment_1 = __importDefault(require("../models/payment"));
const subscription_1 = __importDefault(require("../models/subscription"));
const router = express_1.default.Router();
// Create payment order
router.post('/create-order', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { amount = 99 } = req.body; // ₹99 for premium
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Create Razorpay order
        const order = yield razorpay_1.razorpayService.createOrder(amount, 'INR', `premium_${userId}_${Date.now()}`);
        // Save payment record
        const payment = new payment_1.default({
            userId: new mongodb_1.ObjectId(userId),
            razorpayOrderId: order.id,
            amount,
            currency: 'INR',
            status: 'created',
        });
        yield payment.save();
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    }
    catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
}));
// Verify payment and activate premium
router.post('/verify-payment', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Verify signature
        const isValid = razorpay_1.razorpayService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }
        // Update payment record
        yield payment_1.default.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, {
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            status: 'success',
            updatedAt: new Date(),
        });
        // Activate premium for user
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription
        yield usersCollection.updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                isPremium: true,
                is_premium: true,
                premium_tier: 'premium',
                premium_status: 'active',
                premium_start_date: startDate,
                premium_end_date: endDate,
                premium_auto_renew: true,
                maxSecretCrushes: 10, // Upgrade to 10 crushes
                // Activate verification badge
                is_verified: true,
                verified: true,
                badge_type: 'blue',
                verification_type: 'blue',
                verification_status: 'approved',
                verification_date: new Date(),
                updated_at: new Date(),
            },
        });
        // Create subscription record
        const subscription = new subscription_1.default({
            userId: new mongodb_1.ObjectId(userId),
            razorpaySubscriptionId: razorpay_payment_id, // Using payment ID for now
            razorpayPlanId: 'premium_monthly',
            status: 'active',
            startDate,
            endDate,
            amount: 99,
            currency: 'INR',
        });
        yield subscription.save();
        res.json({
            success: true,
            message: 'Premium activated successfully! You now have a verified badge.',
            premium: {
                tier: 'premium',
                status: 'active',
                startDate,
                endDate,
                features: {
                    secretCrushes: 10,
                    verificationBadge: true,
                    badgeType: 'blue',
                    adFree: true,
                    prioritySupport: true,
                    analytics: true,
                    storyHighlights: true,
                    downloadContent: true,
                    profileViews: true,
                    exclusiveStickers: true,
                    earlyAccess: true,
                },
            },
            badge: {
                type: 'blue',
                verified: true,
                status: 'approved',
            },
        });
    }
    catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
}));
// Get premium status
router.get('/status', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            isPremium: user.isPremium || false,
            premium_tier: user.premium_tier || 'none',
            premium_status: user.premium_status || 'none',
            premium_start_date: user.premium_start_date,
            premium_end_date: user.premium_end_date,
            maxSecretCrushes: user.maxSecretCrushes || 5,
        });
    }
    catch (error) {
        console.error('Get premium status error:', error);
        res.status(500).json({ error: 'Failed to get premium status' });
    }
}));
// Cancel subscription
router.post('/cancel', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Find active subscription
        const subscription = yield subscription_1.default.findOne({
            userId: new mongodb_1.ObjectId(userId),
            status: 'active',
        });
        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription found' });
        }
        // Update subscription status
        subscription.status = 'cancelled';
        subscription.autoRenew = false;
        subscription.updatedAt = new Date();
        yield subscription.save();
        // Update user premium status (keep active until end date)
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        yield usersCollection.updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                premium_auto_renew: false,
                updated_at: new Date(),
            },
        });
        res.json({
            success: true,
            message: 'Subscription cancelled. Premium will remain active until end date.',
            endDate: subscription.endDate,
        });
    }
    catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
}));
exports.default = router;
