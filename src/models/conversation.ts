import mongoose from 'mongoose';

// Define the conversation schema
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  name: {
    type: String,
    default: null // For group conversations
  },
  description: {
    type: String,
    default: null // For group conversations
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
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

// Index for better query performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updated_at: -1 });

// Pre-save middleware to update the updated_at field
conversationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Method to check if user is participant
conversationSchema.methods.isParticipant = function(userId: string) {
  return this.participants.some((participant: any) => 
    participant.toString() === userId.toString()
  );
};

// Method to get other participants (excluding the given user)
conversationSchema.methods.getOtherParticipants = function(userId: string) {
  return this.participants.filter((participant: any) => 
    participant.toString() !== userId.toString()
  );
};

// Create the model if it doesn't exist or get it if it does
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

export default Conversation;
