// Message Model - MongoDB Schema for WebSocket Chat
import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatId: string;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'post' | 'reel';
  mediaUrl?: string;
  replyTo?: mongoose.Types.ObjectId;
  status: 'sent' | 'delivered' | 'read';
  reactions?: Array<{ userId: string; emoji: string }>;
  deleted: boolean;
  deletedAt?: Date;
  readAt?: Date;
  timestamp: Date;
}

const MessageSchema = new Schema<IMessage>({
  chatId: {
    type: String,
    required: true,
    index: true,
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'post', 'reel'],
    default: 'text',
  },
  mediaUrl: {
    type: String,
  },
  replyTo: {
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
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
MessageSchema.index({ chatId: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1, recipientId: 1, timestamp: -1 });
MessageSchema.index({ recipientId: 1, status: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
