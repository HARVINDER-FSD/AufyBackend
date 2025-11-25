import mongoose from 'mongoose'

const subscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tier: {
    type: String,
    enum: ['basic', 'plus', 'pro', 'enterprise'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'pending',
  },
  payment_method: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'paypal'],
    required: true,
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
  billing_cycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
  auto_renew: {
    type: Boolean,
    default: true,
  },
  payment_id: {
    type: String,
    default: null,
  },
  invoice_url: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
})

// Indexes
subscriptionSchema.index({ user_id: 1 })
subscriptionSchema.index({ status: 1, end_date: 1 })
subscriptionSchema.index({ tier: 1 })

export default mongoose.model('Subscription', subscriptionSchema)
