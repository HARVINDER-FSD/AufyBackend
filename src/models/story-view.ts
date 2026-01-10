import mongoose, { Document, Model } from 'mongoose';

// Story View Schema - Track who viewed each story
const storyViewSchema = new mongoose.Schema({
  story_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story',
    required: true
  },
  viewer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewed_at: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate views and improve query performance
storyViewSchema.index({ story_id: 1, viewer_id: 1 }, { unique: true });
storyViewSchema.index({ story_id: 1, viewed_at: -1 });
storyViewSchema.index({ viewer_id: 1, viewed_at: -1 });

// TTL index - auto-delete views after 30 days
storyViewSchema.index({ viewed_at: 1 }, { expireAfterSeconds: 2592000 });

export interface IStoryView extends Document {
  story_id: mongoose.Types.ObjectId;
  viewer_id: mongoose.Types.ObjectId;
  viewed_at: Date;
}

export interface IStoryViewModel extends Model<IStoryView> {}

const StoryView = (mongoose.models.StoryView as IStoryViewModel) || mongoose.model<IStoryView, IStoryViewModel>('StoryView', storyViewSchema);

export default StoryView;
