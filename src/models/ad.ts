import mongoose, { Schema, Document } from 'mongoose';

export interface IAd extends Document {
  brand_name: string;
  avatar_url: string;
  content_url: string; // Image or Video URL
  media_type: 'image' | 'video';
  caption: string;
  cta_text: string; // "Shop Now", "Learn More", etc.
  cta_url: string;
  is_active: boolean;
  target_interests?: string[];
  created_at: Date;
  updated_at: Date;
}

const adSchema = new Schema({
  brand_name: {
    type: String,
    required: true,
    trim: true
  },
  avatar_url: {
    type: String,
    required: true
  },
  content_url: {
    type: String,
    required: true
  },
  media_type: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  caption: {
    type: String,
    required: true
  },
  cta_text: {
    type: String,
    default: 'Learn More'
  },
  cta_url: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  target_interests: {
    type: [String],
    default: []
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for active ads
adSchema.index({ is_active: 1, created_at: -1 });

export default mongoose.model<IAd>('Ad', adSchema);
