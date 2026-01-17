// Message Model - MongoDB Schema for WebSocket Chat
import mongoose, { Schema, Document, Model } from 'mongoose';

const MessageSchema = new Schema({
  conversation_id: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  sender_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: false, // Can be empty if it's media only
  },
  message_type: { // Renamed from type to avoid conflict
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'post', 'reel'],
    default: 'text',
  },
  media_url: {
    type: String,
  },
  media_type: {
    type: String // image, video etc.
  },
  reply_to_id: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  reactions: [{
    userId: String,
    emoji: String,
  }],
  read_by: [{
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    read_at: { type: Date, default: Date.now }
  }],
  is_deleted: {
    type: Boolean,
    default: false,
  },
  is_anonymous: {
    type: Boolean,
    default: false,
  },
  deleted_at: {
    type: Date,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

// Indexes
MessageSchema.index({ conversation_id: 1, created_at: -1 });
MessageSchema.index({ sender_id: 1, created_at: -1 });

export interface IMessage extends Document {
  conversation_id: mongoose.Types.ObjectId;
  sender_id: mongoose.Types.ObjectId;
  content?: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'post' | 'reel';
  media_url?: string;
  media_type?: string;
  reply_to_id?: mongoose.Types.ObjectId;
  status: 'sent' | 'delivered' | 'read';
  reactions: Array<{ userId: string; emoji: string }>;
  read_by: Array<{ user_id: mongoose.Types.ObjectId; read_at: Date }>;
  is_deleted: boolean;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IMessageModel extends Model<IMessage> { }

const Message = (mongoose.models.Message as IMessageModel) || mongoose.model<IMessage, IMessageModel>('Message', MessageSchema);

export default Message;
