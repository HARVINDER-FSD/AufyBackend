import mongoose from 'mongoose';

// Define the follow request schema
const followRequestSchema = new mongoose.Schema({
    requester_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requested_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'declined'],
        default: 'pending'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better query performance
followRequestSchema.index({ requester_id: 1, requested_id: 1 }, { unique: true });
followRequestSchema.index({ requested_id: 1, status: 1 }); // For fetching pending requests
followRequestSchema.index({ requester_id: 1 }); // For user's sent requests

// Pre-save middleware to prevent self-follow requests
followRequestSchema.pre('save', function (next) {
    if (this.requester_id.toString() === this.requested_id.toString()) {
        const error = new Error('Users cannot request to follow themselves');
        return next(error);
    }
    next();
});

// Update updated_at on save
followRequestSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});

// Method to check if a follow request exists
followRequestSchema.statics.findRequest = function (requesterId: string, requestedId: string) {
    return this.findOne({
        requester_id: requesterId,
        requested_id: requestedId
    });
};

// Method to get pending requests for a user (received)
followRequestSchema.statics.getPendingRequests = function (userId: string, limit: number = 20, skip: number = 0) {
    return this.find({
        requested_id: userId,
        status: 'pending'
    })
        .populate('requester_id', 'username full_name avatar_url is_verified badge_type')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);
};

// Method to get sent requests by a user
followRequestSchema.statics.getSentRequests = function (userId: string, limit: number = 20, skip: number = 0) {
    return this.find({
        requester_id: userId,
        status: 'pending'
    })
        .populate('requested_id', 'username full_name avatar_url is_verified badge_type')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);
};

// Method to approve a follow request
followRequestSchema.statics.approveRequest = async function (requestId: string) {
    const request = await this.findById(requestId);
    if (!request) {
        throw new Error('Follow request not found');
    }

    if (request.status !== 'pending') {
        throw new Error('Follow request is not pending');
    }

    // Update status
    request.status = 'approved';
    request.updated_at = new Date();
    await request.save();

    // Create follow relationship
    const Follow = mongoose.model('Follow');
    await Follow.create({
        follower_id: request.requester_id,
        following_id: request.requested_id,
        created_at: new Date()
    });

    // Update follower counts
    await mongoose.model('User').updateOne(
        { _id: request.requester_id },
        { $inc: { following_count: 1 } }
    );

    await mongoose.model('User').updateOne(
        { _id: request.requested_id },
        { $inc: { followers_count: 1 } }
    );

    return request;
};

// Method to decline a follow request
followRequestSchema.statics.declineRequest = async function (requestId: string) {
    const request = await this.findById(requestId);
    if (!request) {
        throw new Error('Follow request not found');
    }

    if (request.status !== 'pending') {
        throw new Error('Follow request is not pending');
    }

    request.status = 'declined';
    request.updated_at = new Date();
    await request.save();

    return request;
};

// Method to cancel a sent request
followRequestSchema.statics.cancelRequest = async function (requesterId: string, requestedId: string) {
    const request = await this.findOne({
        requester_id: requesterId,
        requested_id: requestedId,
        status: 'pending'
    });

    if (!request) {
        throw new Error('Pending follow request not found');
    }

    await request.deleteOne();
    return request;
};

// Create the model if it doesn't exist or get it if it does
const FollowRequest = mongoose.models.FollowRequest || mongoose.model('FollowRequest', followRequestSchema);

export default FollowRequest;
