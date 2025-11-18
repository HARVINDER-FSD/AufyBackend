import mongoose from 'mongoose';

// Define the like schema
const likeSchema = new mongoose.Schema({
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'content_type',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content_type: {
    type: String,
    enum: ['Post', 'Reel', 'Comment'],
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only like a post once
likeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });
likeSchema.index({ user_id: 1, created_at: -1 });
likeSchema.index({ post_id: 1, created_at: -1 });

// Create the model if it doesn't exist or get it if it does
const Like = mongoose.models.Like || mongoose.model('Like', likeSchema);

export default Like;
