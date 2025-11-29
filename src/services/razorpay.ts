import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay only if keys are provided
let razorpay: Razorpay | null = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log('✅ Razorpay initialized');
} else {
  console.log('⚠️  Razorpay not configured (keys missing)');
}

export const razorpayService = {
  // Create order for one-time payment
  async createOrder(amount: number, currency: string = 'INR', receipt: string) {
    if (!razorpay) {
      throw new Error('Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables.');
    }
    try {
      const order = await razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        payment_capture: 1,
      });
      return order;
    } catch (error) {
      console.error('Razorpay create order error:', error);
      throw error;
    }
  },

  // Verify payment signature
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    try {
      const text = `${orderId}|${paymentId}`;
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(text)
        .digest('hex');
      
      return generated_signature === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  },

  // Create subscription plan (one-time setup)
  async createPlan(amount: number, interval: string = 'monthly') {
    if (!razorpay) {
      throw new Error('Razorpay not configured');
    }
    try {
      const plan = await razorpay.plans.create({
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
    } catch (error) {
      console.error('Razorpay create plan error:', error);
      throw error;
    }
  },

  // Create subscription
  async createSubscription(planId: string, totalCount: number = 12) {
    if (!razorpay) {
      throw new Error('Razorpay not configured');
    }
    try {
      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: totalCount, // 12 months
        quantity: 1,
        customer_notify: 1,
      });
      return subscription;
    } catch (error) {
      console.error('Razorpay create subscription error:', error);
      throw error;
    }
  },

  // Cancel subscription
  async cancelSubscription(subscriptionId: string) {
    if (!razorpay) {
      throw new Error('Razorpay not configured');
    }
    try {
      const subscription = await razorpay.subscriptions.cancel(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Razorpay cancel subscription error:', error);
      throw error;
    }
  },

  // Fetch subscription details
  async fetchSubscription(subscriptionId: string) {
    if (!razorpay) {
      throw new Error('Razorpay not configured');
    }
    try {
      const subscription = await razorpay.subscriptions.fetch(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Razorpay fetch subscription error:', error);
      throw error;
    }
  },
};

export default razorpayService;
