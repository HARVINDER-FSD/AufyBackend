import mongoose from 'mongoose';

// Define the bookmark schema
const bookmarkSchema = new mongoose.Schema({
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
    enum: ['Post', 'Reel'],
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only bookmark a post once
bookmarkSchema.index({ post_id: 1, user_id: 1 }, { unique: true });
bookmarkSchema.index({ user_id: 1, created_at: -1 });

// Create the model if it doesn't exist or get it if it does
const Bookmark = mongoose.models.Bookmark || mongoose.model('Bookmark', bookmarkSchema);

export default Bookmark;
