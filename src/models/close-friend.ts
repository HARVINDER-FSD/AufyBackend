import mongoose from 'mongoose'

const closeFriendSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  close_friend_ids: [{
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
closeFriendSchema.index({ user_id: 1 })
closeFriendSchema.index({ user_id: 1, close_friend_ids: 1 })

export default mongoose.model('CloseFriend', closeFriendSchema)
