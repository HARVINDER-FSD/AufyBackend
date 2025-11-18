import mongoose from 'mongoose';

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
followSchema.pre('save', function(next) {
  if (this.follower_id.toString() === this.following_id.toString()) {
    const error = new Error('Users cannot follow themselves');
    return next(error);
  }
  next();
});

// Method to check if user A follows user B
followSchema.statics.isFollowing = function(followerId: string, followingId: string) {
  return this.findOne({
    follower_id: followerId,
    following_id: followingId
  });
};

// Method to get followers count for a user
followSchema.statics.getFollowersCount = function(userId: string) {
  return this.countDocuments({ following_id: userId });
};

// Method to get following count for a user
followSchema.statics.getFollowingCount = function(userId: string) {
  return this.countDocuments({ follower_id: userId });
};

// Method to get followers list
followSchema.statics.getFollowers = function(userId: string, limit: number = 20, skip: number = 0) {
  return this.find({ following_id: userId })
    .populate('follower_id', 'username full_name avatar is_verified')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
};

// Method to get following list
followSchema.statics.getFollowing = function(userId: string, limit: number = 20, skip: number = 0) {
  return this.find({ follower_id: userId })
    .populate('following_id', 'username full_name avatar is_verified')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
};

// Method to follow a user
followSchema.statics.followUser = async function(followerId: string, followingId: string) {
  try {
    // Check if already following
    const existingFollow = await this.findOne({
      follower_id: followerId,
      following_id: followingId
    });

    if (existingFollow) {
      throw new Error('Already following this user');
    }

    // Create follow relationship
    const follow = new this({
      follower_id: followerId,
      following_id: followingId
    });

    await follow.save();

    // Update follower counts in users collection
    await mongoose.model('User').updateOne(
      { _id: followerId },
      { $inc: { following_count: 1 } }
    );

    await mongoose.model('User').updateOne(
      { _id: followingId },
      { $inc: { followers_count: 1 } }
    );

    return follow;
  } catch (error) {
    throw error;
  }
};

// Method to unfollow a user
followSchema.statics.unfollowUser = async function(followerId: string, followingId: string) {
  try {
    const follow = await this.findOneAndDelete({
      follower_id: followerId,
      following_id: followingId
    });

    if (!follow) {
      throw new Error('Not following this user');
    }

    // Update follower counts in users collection
    await mongoose.model('User').updateOne(
      { _id: followerId },
      { $inc: { following_count: -1 } }
    );

    await mongoose.model('User').updateOne(
      { _id: followingId },
      { $inc: { followers_count: -1 } }
    );

    return follow;
  } catch (error) {
    throw error;
  }
};

// Create the model if it doesn't exist or get it if it does
const Follow = mongoose.models.Follow || mongoose.model('Follow', followSchema);

export default Follow;
