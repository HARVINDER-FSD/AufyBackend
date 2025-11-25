import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 60,
  },
  emoji: {
    type: String,
    default: null,
  },
  text_color: {
    type: String,
    default: '#FFFFFF',
  },
  background_style: {
    type: String,
    enum: ['solid', 'gradient', 'transparent'],
    default: 'solid',
  },
  background_color: {
    type: String,
    default: '#6366f1',
  },
  gradient_colors: {
    start: String,
    end: String,
  },
  emotion: {
    type: String,
    enum: ['happy', 'sad', 'excited', 'tired', 'love', 'thinking', 'chill', 'hungry', 'custom'],
    default: 'custom',
  },
  visibility: {
    type: String,
    enum: ['friends', 'crush-list', 'custom'],
    default: 'friends',
  },
  hidden_from: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  reactions: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    emoji: String,
    created_at: {
      type: Date,
      default: Date.now,
    },
  }],
  created_at: {
    type: Date,
    default: Date.now,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
})

// Indexes for performance
noteSchema.index({ user_id: 1, is_active: 1 })
noteSchema.index({ expires_at: 1 })
noteSchema.index({ created_at: -1 })

// Pre-save middleware to set expiration
noteSchema.pre('save', function (next) {
  if (this.isNew && !this.expires_at) {
    this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
  next()
})

// Method to check if note is expired
noteSchema.methods.isExpired = function () {
  return new Date() > this.expires_at
}

// Method to add reaction
noteSchema.methods.addReaction = function (userId: string, emoji: string) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    (r: any) => r.user_id.toString() !== userId
  )
  // Add new reaction
  this.reactions.push({
    user_id: new mongoose.Types.ObjectId(userId),
    emoji,
    created_at: new Date(),
  })
  return this.save()
}

// Method to remove reaction
noteSchema.methods.removeReaction = function (userId: string) {
  this.reactions = this.reactions.filter(
    (r: any) => r.user_id.toString() !== userId
  )
  return this.save()
}

export default mongoose.model('Note', noteSchema)
