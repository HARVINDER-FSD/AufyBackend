import mongoose from 'mongoose';

// Define the comment schema
const commentSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    maxlength: 2200
  },
  parent_comment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  likes_count: {
    type: Number,
    default: 0
  },
  replies_count: {
    type: Number,
    default: 0
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
commentSchema.index({ post_id: 1, created_at: -1 });
commentSchema.index({ user_id: 1 });
commentSchema.index({ parent_comment_id: 1 });

// Pre-save middleware to update the updated_at field
commentSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Create the model if it doesn't exist or get it if it does
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

export default Comment;
