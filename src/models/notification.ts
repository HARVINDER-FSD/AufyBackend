import mongoose from 'mongoose';

export interface INotification {
  _id?: string;
  recipient_id: string;
  sender_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'story_like' | 'story_reply' | 'reel_like' | 'reel_comment';
  content_id?: string; // post_id, reel_id, story_id, comment_id
  content_type?: 'post' | 'reel' | 'story' | 'comment';
  message?: string;
  is_read: boolean;
  created_at: Date;
}

const notificationSchema = new mongoose.Schema({
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'mention', 'reply', 'story_like', 'story_reply', 'reel_like', 'reel_comment'],
    required: true
  },
  content_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  content_type: {
    type: String,
    enum: ['post', 'reel', 'story', 'comment'],
    required: false
  },
  message: {
    type: String,
    required: false
  },
  is_read: {
    type: Boolean,
    default: false,
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for efficient queries
notificationSchema.index({ recipient_id: 1, created_at: -1 });
notificationSchema.index({ recipient_id: 1, is_read: 1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
