import mongoose, { Schema, Document } from 'mongoose';

export interface IReel extends Document {
  user_id: mongoose.Types.ObjectId;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  location?: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  shares_count: number;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

const ReelSchema: Schema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  video_url: { type: String, required: true },
  thumbnail_url: { type: String },
  caption: { type: String, trim: true },
  location: { type: String, trim: true },
  likes_count: { type: Number, default: 0 },
  comments_count: { type: Number, default: 0 },
  views_count: { type: Number, default: 0 },
  shares_count: { type: Number, default: 0 },
  is_archived: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Reel = mongoose.models.Reel || mongoose.model<IReel>('Reel', ReelSchema);

export default Reel;
