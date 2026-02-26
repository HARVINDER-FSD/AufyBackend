import mongoose, { Document, Model } from 'mongoose';

// Define the follow schema
const followSchema = new mongoose.Schema({
  follower_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'pending'],
    default: 'active'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
followSchema.index({ follower_id: 1 });
followSchema.index({ following_id: 1 });
followSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

// Pre-save middleware to prevent self-following
followSchema.pre('save', function (next) {
  if (this.follower_id.toString() === this.following_id.toString()) {
    const error = new Error('Users cannot follow themselves');
    return next(error);
  }
  next();
});

export interface IFollow extends Document {
  follower_id: mongoose.Types.ObjectId;
  following_id: mongoose.Types.ObjectId;
  status: 'active' | 'pending';
  created_at: Date;
}

export interface IFollowModel extends Model<IFollow> {
  isFollowing(followerId: string, followingId: string): Promise<IFollow | null>;
  getFollowersCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  getFollowers(userId: string, limit?: number, skip?: number): Promise<IFollow[]>;
  getFollowing(userId: string, limit?: number, skip?: number): Promise<IFollow[]>;
  followUser(followerId: string, followingId: string): Promise<IFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<IFollow | null>;
}

// Track status change for counter updates
followSchema.pre('save', function (next) {
  if (this.isNew && this.status === 'active') {
    (this as any)._shouldUpdateCounters = true;
  } else if (this.isModified('status') && this.status === 'active') {
    (this as any)._shouldUpdateCounters = true;
  }
  next();
});

// Middleware to update counts automatically
followSchema.post('save', async function (doc) {
  if ((doc as any)._shouldUpdateCounters) {
    const User = mongoose.model('User');
    await Promise.all([
      User.updateOne({ _id: doc.follower_id }, { $inc: { following_count: 1 } }),
      User.updateOne({ _id: doc.following_id }, { $inc: { followers_count: 1 } })
    ]);
  }
});

// For status changes (pending -> active)
followSchema.post('findOneAndUpdate', async function (doc) {
  // Note: This requires { query: true, document: true } in Mongoose 5.x+
  // But simplified here for brevity and common usage
});

followSchema.post('findOneAndDelete', async function (doc) {
  if (doc && doc.status === 'active') {
    const User = mongoose.model('User');
    await Promise.all([
      User.updateOne({ _id: doc.follower_id }, { $inc: { following_count: -1 } }),
      User.updateOne({ _id: doc.following_id }, { $inc: { followers_count: -1 } })
    ]);
  }
});

followSchema.post('deleteOne', { query: true, document: false }, async function () {
  // This is harder to handle because we don't have the doc. 
  // Best practice: Always use findOneAndDelete or model instances.
});

// Method to check if user A follows user B
followSchema.statics.isFollowing = function (followerId: string, followingId: string) {
  return this.findOne({
    follower_id: followerId,
    following_id: followingId
  });
};

// Method to get followers count for a user
followSchema.statics.getFollowersCount = function (userId: string) {
  return this.countDocuments({ following_id: userId, status: 'active' });
};

// Method to get following count for a user
followSchema.statics.getFollowingCount = function (userId: string) {
  return this.countDocuments({ follower_id: userId, status: 'active' });
};

// Method to follow a user
followSchema.statics.followUser = async function (followerId: string, followingId: string, status: string = 'active') {
  const existingFollow = await this.findOne({ follower_id: followerId, following_id: followingId });

  if (existingFollow) {
    // If it was pending and we are now following (or vice versa, though usually it's pending -> active)
    if (existingFollow.status !== status) {
      existingFollow.status = status;
      return await existingFollow.save();
    }
    return existingFollow;
  }

  const newFollow = new this({
    follower_id: followerId,
    following_id: followingId,
    status
  });

  return await newFollow.save();
};

// Method to unfollow a user
followSchema.statics.unfollowUser = async function (followerId: string, followingId: string) {
  return await this.findOneAndDelete({
    follower_id: followerId,
    following_id: followingId
  });
};

// Create the model if it doesn't exist or get it if it does
const Follow = (mongoose.models.Follow as IFollowModel) || mongoose.model<IFollow, IFollowModel>('Follow', followSchema);

export default Follow;
