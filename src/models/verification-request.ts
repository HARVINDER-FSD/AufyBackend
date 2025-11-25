import mongoose from 'mongoose'

const verificationRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requested_type: {
    type: String,
    enum: ['blue', 'gold', 'purple', 'green', 'grey'],
    required: true,
  },
  documents: [{
    type: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  }],
  additional_info: {
    business_name: String,
    website: String,
    social_links: [String],
    github_profile: String,
    linkedin_profile: String,
    reason: String,
    follower_count: Number,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewed_at: {
    type: Date,
    default: null,
  },
  rejection_reason: {
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
verificationRequestSchema.index({ user_id: 1 })
verificationRequestSchema.index({ status: 1, created_at: -1 })
verificationRequestSchema.index({ requested_type: 1 })

export default mongoose.model('VerificationRequest', verificationRequestSchema)
