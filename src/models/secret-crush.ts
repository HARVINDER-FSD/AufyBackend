import mongoose, { Schema, Document } from 'mongoose';

export interface ISecretCrush extends Document {
  userId: mongoose.Types.ObjectId;
  crushUserId: mongoose.Types.ObjectId;
  isMutual: boolean;
  mutualChatId?: string;
  createdAt: Date;
  mutualDetectedAt?: Date;
  notifiedAt?: Date;
  isActive: boolean;
}

const SecretCrushSchema = new Schema<ISecretCrush>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  crushUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isMutual: {
    type: Boolean,
    default: false,
    index: true
  },
  mutualChatId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  mutualDetectedAt: {
    type: Date,
    default: null
  },
  notifiedAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
});

// Compound unique index to prevent duplicate entries
SecretCrushSchema.index({ userId: 1, crushUserId: 1 }, { unique: true });

// Index for mutual detection queries
SecretCrushSchema.index({ crushUserId: 1, isActive: 1 });

// Index for listing user's crushes
SecretCrushSchema.index({ userId: 1, isMutual: 1, isActive: 1 });

// Prevent self-crush
SecretCrushSchema.pre('save', function(next) {
  if (this.userId.equals(this.crushUserId)) {
    next(new Error('Cannot add yourself as secret crush'));
  }
  next();
});

export const SecretCrush = mongoose.model<ISecretCrush>('SecretCrush', SecretCrushSchema);
