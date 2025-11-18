import mongoose from 'mongoose';

// Define the post schema
const postSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    required: true,
    maxlength: 2200
  },
  media_urls: [{
    type: String,
    required: true
  }],
  media_type: {
    type: String,
    enum: ['text', 'image', 'video', 'carousel'],
    default: 'text'
  },
  location: {
    type: String,
    default: null
  },
  likes_count: {
    type: Number,
    default: 0
  },
  comments_count: {
    type: Number,
    default: 0
  },
  shares_count: {
    type: Number,
    default: 0
  },
  is_archived: {
    type: Boolean,
    default: false
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  hashtags: [{
    type: String
  }],
  mentions: [{
    type: String
  }],
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
postSchema.index({ user_id: 1, created_at: -1 });
postSchema.index({ created_at: -1 });
postSchema.index({ hashtags: 1 });

// Pre-save middleware to update the updated_at field
postSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Method to extract hashtags from caption
postSchema.methods.extractHashtags = function() {
  const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
  const matches = this.caption.match(hashtagRegex);
  this.hashtags = matches ? matches.map(tag => tag.toLowerCase()) : [];
};

// Method to extract mentions from caption
postSchema.methods.extractMentions = function() {
  const mentionRegex = /@[\w\u0590-\u05ff]+/g;
  const matches = this.caption.match(mentionRegex);
  this.mentions = matches ? matches.map(mention => mention.toLowerCase()) : [];
};

// Create the model if it doesn't exist or get it if it does
const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

export default Post;