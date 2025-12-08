import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Define the user schema
const userSchema = new mongoose.Schema({
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
    default: 5  // Free: 5 crushes, Premium (₹99/month): 10 crushes
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
  settings: {
    type: mongoose.Schema.Types.Mixed,
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
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password for login
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to return user data without password
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Create the model if it doesn't exist or get it if it does
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;