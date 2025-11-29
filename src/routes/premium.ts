import express from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../lib/database';
import { authenticateToken } from '../middleware/auth';
import razorpayService from '../services/razorpay';
import Payment from '../models/payment';
import Subscription from '../models/subscription';

const router = express.Router();

interface AuthRequest extends express.Request {
  user?: {
    userId: string;
    email: string;
    username: string;
  };
}

// Create payment order
router.post('/create-order', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { amount = 99 } = req.body; // ₹99 for premium

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create Razorpay order
    const order = await razorpayService.createOrder(
      amount,
      'INR',
      `premium_${userId}_${Date.now()}`
    );

    // Save payment record
    const payment = new Payment({
      userId: new ObjectId(userId),
      razorpayOrderId: order.id,
      amount,
      currency: 'INR',
      status: 'created',
    });
    await payment.save();

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment and activate premium
router.post('/verify-payment', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update payment record
    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'success',
        updatedAt: new Date(),
      }
    );

    // Activate premium for user
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          isPremium: true,
          premium_tier: 'premium',
          premium_status: 'active',
          premium_start_date: startDate,
          premium_end_date: endDate,
          premium_auto_renew: true,
          maxSecretCrushes: 10, // Upgrade to 10 crushes
          updated_at: new Date(),
        },
      }
    );

    // Create subscription record
    const subscription = new Subscription({
      userId: new ObjectId(userId),
      razorpaySubscriptionId: razorpay_payment_id, // Using payment ID for now
      razorpayPlanId: 'premium_monthly',
      status: 'active',
      startDate,
      endDate,
      amount: 99,
      currency: 'INR',
    });
    await subscription.save();

    res.json({
      success: true,
      message: 'Premium activated successfully!',
      premium: {
        tier: 'premium',
        status: 'active',
        startDate,
        endDate,
        features: {
          secretCrushes: 10,
          verificationBadge: true,
          adFree: true,
          prioritySupport: true,
        },
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Get premium status
router.get('/status', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

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
  } catch (error) {
    console.error('Get premium status error:', error);
    res.status(500).json({ error: 'Failed to get premium status' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find active subscription
    const subscription = await Subscription.findOne({
      userId: new ObjectId(userId),
      status: 'active',
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    subscription.updatedAt = new Date();
    await subscription.save();

    // Update user premium status (keep active until end date)
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          premium_auto_renew: false,
          updated_at: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: 'Subscription cancelled. Premium will remain active until end date.',
      endDate: subscription.endDate,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
