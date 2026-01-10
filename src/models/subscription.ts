import mongoose, { Document, Model } from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
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

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  status: 'created' | 'active' | 'paused' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  amount: number;
  currency: string;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionModel extends Model<ISubscription> {}

const Subscription = (mongoose.models.Subscription as ISubscriptionModel) || mongoose.model<ISubscription, ISubscriptionModel>('Subscription', subscriptionSchema);

export default Subscription;
