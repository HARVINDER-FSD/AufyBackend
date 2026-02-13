import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  user_id: mongoose.Types.ObjectId;
  actor_id?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  content?: string;
  data?: any;
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
}

const notificationSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String
  },
  data: {
    type: Schema.Types.Mixed
  },
  is_read: {
    type: Boolean,
    default: false
  },
  is_anonymous: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for better query performance
notificationSchema.index({ user_id: 1, created_at: -1 });

export default mongoose.model<INotification>('Notification', notificationSchema);
