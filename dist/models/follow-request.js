"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Define the follow request schema
const followRequestSchema = new mongoose_1.default.Schema({
    requester_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requested_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
followRequestSchema.statics.findRequest = function (requesterId, requestedId) {
    return this.findOne({
        requester_id: requesterId,
        requested_id: requestedId
    });
};
// Method to get pending requests for a user (received)
followRequestSchema.statics.getPendingRequests = function (userId, limit = 20, skip = 0) {
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
followRequestSchema.statics.getSentRequests = function (userId, limit = 20, skip = 0) {
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
followRequestSchema.statics.approveRequest = function (requestId) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield this.findById(requestId);
        if (!request) {
            throw new Error('Follow request not found');
        }
        if (request.status !== 'pending') {
            throw new Error('Follow request is not pending');
        }
        // Update status
        request.status = 'approved';
        request.updated_at = new Date();
        yield request.save();
        // Create follow relationship
        const Follow = mongoose_1.default.model('Follow');
        yield Follow.create({
            follower_id: request.requester_id,
            following_id: request.requested_id,
            created_at: new Date()
        });
        // Update follower counts
        yield mongoose_1.default.model('User').updateOne({ _id: request.requester_id }, { $inc: { following_count: 1 } });
        yield mongoose_1.default.model('User').updateOne({ _id: request.requested_id }, { $inc: { followers_count: 1 } });
        return request;
    });
};
// Method to decline a follow request
followRequestSchema.statics.declineRequest = function (requestId) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield this.findById(requestId);
        if (!request) {
            throw new Error('Follow request not found');
        }
        if (request.status !== 'pending') {
            throw new Error('Follow request is not pending');
        }
        request.status = 'declined';
        request.updated_at = new Date();
        yield request.save();
        return request;
    });
};
// Method to cancel a sent request
followRequestSchema.statics.cancelRequest = function (requesterId, requestedId) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = yield this.findOne({
            requester_id: requesterId,
            requested_id: requestedId,
            status: 'pending'
        });
        if (!request) {
            throw new Error('Pending follow request not found');
        }
        yield request.deleteOne();
        return request;
    });
};
// Create the model if it doesn't exist or get it if it does
const FollowRequest = mongoose_1.default.models.FollowRequest || mongoose_1.default.model('FollowRequest', followRequestSchema);
exports.default = FollowRequest;
