import mongoose from 'mongoose';

// Define the profile visit schema
const profileVisitSchema = new mongoose.Schema({
  profile_owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visitor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visited_at: {
    type: Date,
    default: Date.now
  },
  ip_address: {
    type: String,
    default: 'unknown'
  },
  user_agent: {
    type: String,
    default: 'unknown'
  }
});

// Index for better query performance
profileVisitSchema.index({ profile_owner_id: 1, visited_at: -1 });
profileVisitSchema.index({ visitor_id: 1, visited_at: -1 });
profileVisitSchema.index({ profile_owner_id: 1, visitor_id: 1 });

// Compound index to prevent duplicate visits from same user in short time
profileVisitSchema.index(
  { profile_owner_id: 1, visitor_id: 1, visited_at: 1 },
  { 
    unique: false,
    partialFilterExpression: {
      visited_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }
  }
);

// Method to check if user visited profile recently
profileVisitSchema.statics.hasVisitedRecently = function(profileOwnerId: string, visitorId: string, hours: number = 24) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.findOne({
    profile_owner_id: profileOwnerId,
    visitor_id: visitorId,
    visited_at: { $gte: cutoffTime }
  });
};

// Method to get visitor count for a profile
profileVisitSchema.statics.getVisitorCount = function(profileOwnerId: string, days: number = 30) {
  const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.countDocuments({
    profile_owner_id: profileOwnerId,
    visited_at: { $gte: cutoffTime }
  });
};

// Method to get unique visitors for a profile
profileVisitSchema.statics.getUniqueVisitorCount = function(profileOwnerId: string, days: number = 30) {
  const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.distinct('visitor_id', {
    profile_owner_id: profileOwnerId,
    visited_at: { $gte: cutoffTime }
  });
};

// Create the model if it doesn't exist or get it if it does
const ProfileVisit = mongoose.models.ProfileVisit || mongoose.model('ProfileVisit', profileVisitSchema);

export default ProfileVisit;
