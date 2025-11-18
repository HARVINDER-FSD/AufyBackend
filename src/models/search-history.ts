import mongoose from 'mongoose';

export interface ISearchHistory {
    _id?: string;
    user_id: string;
    query: string;
    type: 'user' | 'hashtag' | 'general';
    created_at: Date;
}

const searchHistorySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    query: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['user', 'hashtag', 'general'],
        default: 'general'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Compound index for efficient queries
searchHistorySchema.index({ user_id: 1, created_at: -1 });

// TTL index - auto-delete after 30 days
searchHistorySchema.index({ created_at: 1 }, { expireAfterSeconds: 2592000 });

const SearchHistory = mongoose.models.SearchHistory || mongoose.model('SearchHistory', searchHistorySchema);

export default SearchHistory;
