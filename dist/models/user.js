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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Define the user schema
const userSchema = new mongoose_1.default.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        default: null,
        sparse: true, // Allows multiple null values
    },
    phone_verified: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        required: true
    },
    full_name: {
        type: String,
        required: true
    },
    date_of_birth: {
        type: Date,
        required: true
    },
    bio: {
        type: String,
        default: ''
    },
    links: {
        type: [String],
        default: []
    },
    avatar_url: {
        type: String,
        default: '/placeholder-user.jpg'
    },
    is_verified: {
        type: Boolean,
        default: false
    },
    badge_type: {
        type: String,
        enum: ['blue', 'gold', 'purple', 'green', 'gray', null],
        default: null
    },
    verification_type: {
        type: String,
        enum: ['blue', 'gold', 'purple', 'green', 'gray', null],
        default: null
    },
    verification_date: {
        type: Date,
        default: null
    },
    verification_status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none'
    },
    // Premium subscription fields (₹99/month)
    premium_tier: {
        type: String,
        enum: ['none', 'premium'],
        default: 'none'
    },
    premium_status: {
        type: String,
        enum: ['none', 'active', 'cancelled', 'expired'],
        default: 'none'
    },
    premium_start_date: {
        type: Date,
        default: null
    },
    premium_end_date: {
        type: Date,
        default: null
    },
    premium_auto_renew: {
        type: Boolean,
        default: true
    },
    is_private: {
        type: Boolean,
        default: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    followers_count: {
        type: Number,
        default: 0
    },
    following_count: {
        type: Number,
        default: 0
    },
    // Secret Crush Feature
    secretCrushCount: {
        type: Number,
        default: 0
    },
    maxSecretCrushes: {
        type: Number,
        default: 5 // Free: 5 crushes, Premium (₹99/month): 10 crushes
    },
    isPremium: {
        type: Boolean,
        default: false
    },
    posts_count: {
        type: Number,
        default: 0
    },
    fcmToken: {
        type: String,
        default: null
    },
    pushToken: {
        type: String,
        default: null
    },
    pushTokenPlatform: {
        type: String,
        default: null
    },
    pushTokenUpdatedAt: {
        type: Date,
        default: null
    },
    settings: {
        type: mongoose_1.default.Schema.Types.Mixed,
        default: {
            // Privacy Settings
            darkMode: true,
            privateAccount: false,
            showOnlineStatus: true,
            allowTagging: true,
            allowMentions: true,
            showReadReceipts: true,
            whoCanMessage: 'everyone',
            whoCanSeeStories: 'everyone',
            whoCanSeeFollowers: 'everyone',
            // Message Privacy
            groupRequests: true,
            messageReplies: 'everyone',
            showActivityStatus: true,
            readReceipts: true,
            // Message Requests Filters
            filterOffensive: true,
            filterLowQuality: true,
            filterUnknown: false,
            // Media Settings
            saveOriginalPhotos: false,
            uploadQuality: 'normal',
            autoPlayVideos: true,
            useLessData: false,
            // Notifications
            pushNotifications: true,
            emailNotifications: false,
            likes: true,
            comments: true,
            follows: true,
            mentions: true,
            directMessages: true,
            liveVideos: false,
            stories: true,
            posts: true,
            marketing: false,
            security: true,
            // Well-being
            quietModeEnabled: false,
            quietModeStart: '22:00',
            quietModeEnd: '07:00',
            takeBreakEnabled: false,
            takeBreakInterval: 30,
            dailyLimitEnabled: false,
            dailyLimitMinutes: 60,
            // Limits
            limitComments: false,
            limitMessages: false,
            limitTags: false,
            // AI & Personalization
            suggestedReels: true,
            adsPersonalization: true,
            dataSharing: false,
            // Sharing to Other Apps
            shareToFacebook: false,
            shareToThreads: false,
            shareToTwitter: false,
            shareToTumblr: false,
            // Device Permissions
            cameraPermission: true,
            microphonePermission: true,
            photosPermission: true,
            locationPermission: false,
        }
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
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
// Pre-save middleware to hash password
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        // Only hash the password if it's modified or new
        if (!this.isModified('password'))
            return next();
        try {
            // Generate salt and hash password
            const salt = yield bcryptjs_1.default.genSalt(10);
            this.password = yield bcryptjs_1.default.hash(this.password, salt);
            next();
        }
        catch (error) {
            next(error);
        }
    });
});
// Method to compare password for login
userSchema.methods.comparePassword = function (candidatePassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return bcryptjs_1.default.compare(candidatePassword, this.password);
    });
};
// Method to return user data without password
userSchema.methods.toJSON = function () {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};
// Create the model if it doesn't exist or get it if it does
const User = mongoose_1.default.models.User || mongoose_1.default.model('User', userSchema);
exports.default = User;
