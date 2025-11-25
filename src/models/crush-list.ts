import mongoose from 'mongoose'

const crushListSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  crush_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
})

// Index for faster queries
crushListSchema.index({ user_id: 1, crush_ids: 1 })

export default mongoose.model('CrushList', crushListSchema)
