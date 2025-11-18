import mongoose from 'mongoose';

export interface IBlockedUser {
  _id?: string;
  blocker_id: string;
  blocked_id: string;
  created_at: Date;
}

const blockedUserSchema = new mongoose.Schema({
  blocker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  blocked_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
blockedUserSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });

const BlockedUser = mongoose.models.BlockedUser || mongoose.model('BlockedUser', blockedUserSchema);

export default BlockedUser;
