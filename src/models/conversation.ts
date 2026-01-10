import mongoose, { Document, Model } from 'mongoose';

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true,
    default: 'direct'
  },
  name: {
    type: String,
    trim: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joined_at: {
      type: Date,
      default: Date.now
    },
    left_at: {
      type: Date
    }
  }],
  last_message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ type: 1 });

export interface IConversation extends Document {
  type: 'direct' | 'group';
  name?: string;
  created_by: mongoose.Types.ObjectId;
  participants: {
    user: mongoose.Types.ObjectId;
    role: 'admin' | 'member';
    joined_at: Date;
    left_at?: Date;
  }[];
  last_message?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

export interface IConversationModel extends Model<IConversation> {}

const Conversation = (mongoose.models.Conversation as IConversationModel) || mongoose.model<IConversation, IConversationModel>('Conversation', conversationSchema);

export default Conversation;
