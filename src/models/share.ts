import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema({
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    enum: ['internal', 'whatsapp', 'facebook', 'twitter', 'copy_link', 'other'],
    default: 'internal'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index to track unique shares if needed, or just fast lookups
shareSchema.index({ post_id: 1, user_id: 1 });
shareSchema.index({ user_id: 1, created_at: -1 });

const Share = mongoose.models.Share || mongoose.model('Share', shareSchema);

export default Share;
