import StoryModel from "../models/story"
import UserModel from "../models/user"
import StoryViewModel from "../models/story-view"
import FollowModel from "../models/follow"
import { StorageService } from "../lib/storage"
import type { Story, CreateStoryRequest } from "../lib/types"
import { errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"
import { cache } from "../lib/database"
import mongoose from "mongoose"

export class StoryService {
  // Create story
  static async createStory(userId: string, storyData: CreateStoryRequest): Promise<Story> {
    const { media_url, media_type, content } = storyData

    if (!media_url) {
      throw errors.badRequest("Media URL is required for stories")
    }

    if (!["image", "video"].includes(media_type)) {
      throw errors.badRequest("Media type must be 'image' or 'video'")
    }

    if (content && content.length > 500) {
      throw errors.badRequest("Story content too long (max 500 characters)")
    }

    const storyDoc = await StoryModel.create({
      user_id: userId,
      media_url,
      media_type,
      caption: content,
      // expires_at is handled by pre-save hook in model
    });

    // Get user data
    const user = await UserModel.findById(userId).select('username full_name avatar_url is_verified');

    const storyWithUser: Story = {
      id: storyDoc._id.toString(),
      user_id: storyDoc.user_id.toString(),
      media_url: storyDoc.media_url,
      media_type: storyDoc.media_type as "image" | "video",
      content: storyDoc.caption,
      expires_at: storyDoc.expires_at,
      is_archived: storyDoc.is_deleted, 
      created_at: storyDoc.created_at,
      user: user ? {
        id: user._id.toString(),
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        email: user.email,
        is_private: user.is_private,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      } : undefined,
      is_viewed: false,
    }

    // Clear user stories cache
    await cache.del(cacheKeys.userStories(userId))
    await cache.invalidatePattern(`${config.redis.keyPrefix}stories:*`)

    return storyWithUser
  }

  // Get user stories
  static async getUserStories(userId: string, currentUserId?: string): Promise<Story[]> {
    // Check cache first
    const cacheKey = cacheKeys.userStories(userId)
    const cachedStories = await cache.get(cacheKey)
    if (cachedStories && !currentUserId) {
      return cachedStories as Story[]
    }

    // Find stories
    const storiesDocs = await StoryModel.find({
      user_id: userId,
      expires_at: { $gt: new Date() },
      is_deleted: false
    }).sort({ created_at: -1 });

    // Get user info (assumed same for all stories)
    const user = await UserModel.findById(userId).select('username full_name avatar_url is_verified');

    if (!user || !user.is_active) {
        return [];
    }

    const stories = await Promise.all(
      storiesDocs.map(async (storyDoc) => {
        const story: Story = {
          id: storyDoc._id.toString(),
          user_id: storyDoc.user_id.toString(),
          media_url: storyDoc.media_url,
          media_type: storyDoc.media_type as "image" | "video",
          content: storyDoc.caption,
          expires_at: storyDoc.expires_at,
          is_archived: storyDoc.is_deleted,
          created_at: storyDoc.created_at,
          user: {
            id: user._id.toString(),
            username: user.username,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            is_verified: user.is_verified,
            email: user.email,
            is_private: user.is_private,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at
          },
        }

        // Check if current user has viewed this story
        if (currentUserId) {
          const view = await StoryViewModel.findOne({
            story_id: storyDoc._id,
            viewer_id: currentUserId
          });
          story.is_viewed = !!view;
        }

        return story
      }),
    )

    // Cache stories (without view status)
    if (!currentUserId) {
      await cache.set(cacheKey, stories, config.redis.ttl.story)
    }

    return stories
  }

  // Get stories feed (stories from followed users)
  static async getStoriesFeed(userId: string): Promise<Array<{ user: any; stories: Story[] }>> {
    // Get following list
    const following = await FollowModel.find({ 
      follower_id: userId, 
      status: 'active' 
    }).select('following_id');
    
    const followingIds = following.map(f => f.following_id);
    
    // Also include own stories
    followingIds.push(new mongoose.Types.ObjectId(userId));

    // Find users who have active stories
    // We can do an aggregation or just find stories where user_id is in followingIds
    const activeStories = await StoryModel.aggregate([
      {
        $match: {
          user_id: { $in: followingIds },
          expires_at: { $gt: new Date() },
          is_deleted: false
        }
      },
      {
        $group: {
          _id: "$user_id",
          count: { $sum: 1 }
        }
      }
    ]);

    const activeUserIds = activeStories.map(s => s._id);

    const userStoriesPromises = activeUserIds.map(async (uid) => {
      const stories = await this.getUserStories(uid.toString(), userId)
      if (stories.length === 0) return null;

      // Stories already contain user info, so we can extract it from the first story
      const user = stories[0].user;
      
      return {
        user: {
            id: user!.id,
            username: user!.username,
            full_name: user!.full_name,
            avatar_url: user!.avatar_url,
            is_verified: user!.is_verified
        },
        stories,
      }
    })

    const userStories = await Promise.all(userStoriesPromises)
    return userStories.filter((item): item is { user: any; stories: Story[] } => item !== null)
  }

  // View story
  static async viewStory(storyId: string, viewerId: string): Promise<void> {
    // Check if story exists and is not expired
    const story = await StoryModel.findOne({
        _id: storyId,
        expires_at: { $gt: new Date() },
        is_deleted: false
    });

    if (!story) {
      throw errors.notFound("Story not found or expired")
    }

    // Don't record view if it's the story owner
    if (story.user_id.toString() === viewerId) {
      return
    }

    // Insert view record (ignore if already exists handled by unique index)
    try {
        await StoryViewModel.create({
            story_id: storyId,
            viewer_id: viewerId
        });
        
        // Increment view count on story
        story.views_count = (story.views_count || 0) + 1;
        await story.save();
        
    } catch (error: any) {
        if (error.code !== 11000) { // 11000 is duplicate key error
            throw error;
        }
    }

    // Clear cache
    await cache.del(cacheKeys.userStories(story.user_id.toString()))
  }

  // Get story views
  static async getStoryViews(storyId: string, userId: string): Promise<Array<any>> {
    // Verify story ownership
    const story = await StoryModel.findById(storyId);
    
    if (!story) {
        throw errors.notFound("Story not found");
    }
    
    if (story.user_id.toString() !== userId) {
      throw errors.forbidden("You can only view your own story views")
    }

    const views = await StoryViewModel.find({ story_id: storyId })
        .sort({ viewed_at: -1 })
        .populate('viewer_id', 'username full_name avatar_url is_verified');

    return views.map((view) => {
        const viewer = view.viewer_id as any; // populated
        if (!viewer) return null;
        
        return {
            id: viewer._id.toString(),
            username: viewer.username,
            full_name: viewer.full_name,
            avatar_url: viewer.avatar_url,
            is_verified: viewer.is_verified,
            viewed_at: view.viewed_at,
        }
    }).filter(v => v !== null);
  }

  // Delete story
  static async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await StoryModel.findById(storyId);

    if (!story) {
      throw errors.notFound("Story not found")
    }

    // Verify ownership
    if (story.user_id.toString() !== userId) {
      throw errors.forbidden("You don't have permission to delete this story. Only the story owner can delete it.")
    }

    // Soft delete
    story.is_deleted = true;
    await story.save();

    // Delete media file from S3
    try {
      const urlParts = story.media_url.split("/")
      const key = urlParts.slice(-3).join("/") 
      await StorageService.deleteFile(key)
    } catch (error) {
      console.error("Failed to delete story media:", error)
    }

    // Clear cache
    await cache.del(cacheKeys.userStories(userId))
    await cache.invalidatePattern(`${config.redis.keyPrefix}stories:*`)
  }

  // Archive expired stories (cleanup job)
  static async archiveExpiredStories(): Promise<number> {
    const result = await StoryModel.updateMany(
        { expires_at: { $lte: new Date() }, is_deleted: false },
        { $set: { is_deleted: true } } // Assuming archive means soft delete here, or maybe we should leave them as expired?
        // Original SQL: UPDATE stories SET is_archived = true WHERE expires_at <= NOW() AND is_archived = false
        // My Model has is_deleted, not is_archived field.
        // If I assume is_deleted == is_archived
    );

    // Clear all stories cache
    await cache.invalidatePattern(`${config.redis.keyPrefix}stories:*`)

    return result.modifiedCount
  }
}
