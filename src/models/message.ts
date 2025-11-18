import mongoose from 'mongoose';

// Define the message schema
const messageSchema = new mongoose.Schema({
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  message_type: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'emoji', 'shared_post', 'shared_story'],
    default: 'text'
  },
  media_url: {
    type: String,
    default: null
  },
  media_metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  shared_content: {
    content_type: {
      type: String,
      enum: ['post', 'story'],
      default: null
    },
    content_id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'shared_content.content_type_ref',
      default: null
    },
    content_type_ref: {
      type: String,
      enum: ['Post', 'Story'],
      default: null
    },
    preview_data: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date,
    default: null
  },
  is_edited: {
    type: Boolean,
    default: false
  },
  edited_at: {
    type: Date,
    default: null
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: {
    type: Date,
    default: null
  },
  reply_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  reactions: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
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
messageSchema.index({ conversation_id: 1, created_at: -1 });
messageSchema.index({ sender_id: 1 });
messageSchema.index({ recipient_id: 1, is_read: 1 });

// Pre-save middleware to update the updated_at field
messageSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.is_read = true;
  this.read_at = new Date();
  return this.save();
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId: string, emoji: string) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter((reaction: any) => 
    reaction.user_id.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    user_id: userId,
    emoji: emoji,
    created_at: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId: string) {
  this.reactions = this.reactions.filter((reaction: any) => 
    reaction.user_id.toString() !== userId.toString()
  );
  
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.content = '[Message deleted]';
  return this.save();
};

// Create the model if it doesn't exist or get it if it does
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

export default Message;
