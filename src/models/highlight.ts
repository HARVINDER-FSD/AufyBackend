import mongoose from 'mongoose'

const highlightSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 50,
  },
  cover_image: {
    type: String,
    required: true,
  },
  stories: [{
    story_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
    },
    is_remix: {
      type: Boolean,
      default: false,
    },
    original_creator: {
      id: mongoose.Schema.Types.ObjectId,
      username: String,
      avatar: String,
    },
    added_at: {
      type: Date,
      default: Date.now,
    },
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

// Indexes
highlightSchema.index({ user_id: 1, created_at: -1 })

export default mongoose.model('Highlight', highlightSchema)
