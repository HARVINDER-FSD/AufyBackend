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
exports.razorpayService = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
// Initialize Razorpay only if keys are provided
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new razorpay_1.default({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized');
}
else {
    console.log('⚠️  Razorpay not configured (keys missing)');
}
exports.razorpayService = {
    // Create order for one-time payment
    createOrder(amount_1) {
        return __awaiter(this, arguments, void 0, function* (amount, currency = 'INR', receipt) {
            if (!razorpay) {
                throw new Error('Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables.');
            }
            try {
                const order = yield razorpay.orders.create({
                    amount: amount * 100, // Convert to paise
                    currency,
                    receipt,
                    payment_capture: 1,
                });
                return order;
            }
            catch (error) {
                console.error('Razorpay create order error:', error);
                throw error;
            }
        });
    },
    // Verify payment signature
    verifyPaymentSignature(orderId, paymentId, signature) {
        try {
            const text = `${orderId}|${paymentId}`;
            const generated_signature = crypto_1.default
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
                .update(text)
                .digest('hex');
            return generated_signature === signature;
        }
        catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    },
    // Create subscription plan (one-time setup)
    createPlan(amount_1) {
        return __awaiter(this, arguments, void 0, function* (amount, interval = 'monthly') {
            if (!razorpay) {
                throw new Error('Razorpay not configured');
            }
            try {
                const plan = yield razorpay.plans.create({
                    period: interval,
                    interval: 1,
                    item: {
                        name: 'Anufy Premium',
                        amount: amount * 100, // Convert to paise
                        currency: 'INR',
                        description: 'Anufy Premium Subscription - 10 Secret Crushes, Verification Badge, Ad-free',
                    },
                });
                return plan;
            }
            catch (error) {
                console.error('Razorpay create plan error:', error);
                throw error;
            }
        });
    },
    // Create subscription
    createSubscription(planId_1) {
        return __awaiter(this, arguments, void 0, function* (planId, totalCount = 12) {
            if (!razorpay) {
                throw new Error('Razorpay not configured');
            }
            try {
                const subscription = yield razorpay.subscriptions.create({
                    plan_id: planId,
                    total_count: totalCount, // 12 months
                    quantity: 1,
                    customer_notify: 1,
                });
                return subscription;
            }
            catch (error) {
                console.error('Razorpay create subscription error:', error);
                throw error;
            }
        });
    },
    // Cancel subscription
    cancelSubscription(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!razorpay) {
                throw new Error('Razorpay not configured');
            }
            try {
                const subscription = yield razorpay.subscriptions.cancel(subscriptionId);
                return subscription;
            }
            catch (error) {
                console.error('Razorpay cancel subscription error:', error);
                throw error;
            }
        });
    }
};
