import mongoose from 'mongoose';

export interface IReport {
  _id?: string;
  reporter_id: string;
  reported_user_id?: string;
  content_id?: string;
  content_type?: 'post' | 'reel' | 'story' | 'comment' | 'user';
  reason: 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'nudity' | 'false_info' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  reviewed_by?: string;
  reviewed_at?: Date;
  action_taken?: string;
  created_at: Date;
}

const reportSchema = new mongoose.Schema({
  reporter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reported_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  content_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  content_type: {
    type: String,
    enum: ['post', 'reel', 'story', 'comment', 'user'],
    required: false
  },
  reason: {
    type: String,
    enum: ['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'false_info', 'other'],
    required: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'action_taken', 'dismissed'],
    default: 'pending',
    index: true
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  reviewed_at: {
    type: Date,
    required: false
  },
  action_taken: {
    type: String,
    required: false
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes
reportSchema.index({ status: 1, created_at: -1 });
reportSchema.index({ content_id: 1, content_type: 1 });

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

export default Report;
