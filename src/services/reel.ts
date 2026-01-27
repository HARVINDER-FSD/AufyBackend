import { getDatabase, cache } from "../lib/database"
import { StorageService } from "../lib/storage"
import { cacheLLen, cacheLRange } from "../lib/redis"
import { logger } from "../middleware/logger"
import type { Reel, CreateReelRequest, PaginatedResponse, User } from "../lib/types"
import { pagination, errors } from "../lib/utils"
import { maskAnonymousUser } from "../lib/anonymous-utils"
import { ObjectId } from "mongodb"

export class ReelService {
  // Create reel
  static async createReel(userId: string, reelData: CreateReelRequest): Promise<Reel> {
    const { video_url, thumbnail_url, title, description, duration } = reelData

    if (!video_url) {
      throw errors.badRequest("Video URL is required for reels")
    }

    const db = await getDatabase()
    const reelsCollection = db.collection('reels')
    const usersCollection = db.collection('users')

    const reelDoc = {
      user_id: new ObjectId(userId),
      video_url,
      thumbnail_url: thumbnail_url || null,
      title: title || null,
      description: description || null,
      duration: duration || 0,
      view_count: 0,
      is_public: true,
      is_deleted: false,
      is_archived: false,
      created_at: new Date(),
      updated_at: new Date()
    }

    const result = await reelsCollection.insertOne(reelDoc)

    // Get user data
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) })

    if (!user) {
      throw errors.notFound("User not found")
    }

    return {
      id: result.insertedId.toString(),
      user_id: userId,
      video_url,
      thumbnail_url: thumbnail_url || '',
      title: title || '',
      description: description || '',
      duration: duration || 0,
      view_count: 0,
      is_public: true,
      created_at: new Date(),
      updated_at: new Date(),
      user: {
        id: user._id.toString(),
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url || '',
        is_verified: user.is_verified || false,
        is_following: false
      },
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      is_following: false
    }
  }

  // Get reels feed (Instagram-Level Advanced Algorithm)
  static async getReelsFeed(currentUserId?: string, page = 1, limit = 20): Promise<PaginatedResponse<Reel>> {
    try {
      const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
      const offset = pagination.getOffset(validPage, validLimit)

      const db = await getDatabase()
      const reelsCollection = db.collection('reels')
      const followsCollection = db.collection('follows')

      // --- FAN-OUT READ STRATEGY (Hybrid) ---
      // Try to read from Redis List first (Makhan Mode) for Followed Users
      const listKey = `reels:feed:${currentUserId}:list`;
      let fanOutReels: any[] = [];
      let fanOutIds: string[] = [];
      
      if (currentUserId && page === 1) { // Only check fan-out on first page for speed
          const listLen = await cacheLLen(listKey);
          if (listLen > 0) {
              const reelIds = await cacheLRange(listKey, 0, 9); // Get top 10 new reels
              if (reelIds.length > 0) {
                  fanOutIds = reelIds;
                  const objectIds = reelIds.map(id => new ObjectId(id));
                  
                  // Fetch these specific reels efficiently
                  const fetchedReels = await reelsCollection.aggregate([
                      { $match: { _id: { $in: objectIds } } },
                      {
                          $lookup: {
                              from: 'users',
                              localField: 'user_id',
                              foreignField: '_id',
                              as: 'user'
                          }
                      },
                      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                      { $addFields: { is_following_creator: true, is_liked: false, likes_count: 0, comments_count: 0 } } // Simplified for speed
                  ]).toArray();
                  
                  // Re-order to match list order
                  const reelMap = new Map(fetchedReels.map(r => [r._id.toString(), r]));
                  fanOutReels = reelIds.map(id => reelMap.get(id)).filter(r => r);
                  logger.debug(`[Perf] Reels Fan-out Hit: ${fanOutReels.length} items`);
              }
          }
      }

      // 1. Get Social Graph (Who does the user follow?)
      let followedUserIds: ObjectId[] = []
      if (currentUserId && ObjectId.isValid(currentUserId)) {
        const follows = await followsCollection
          .find({ follower_id: new ObjectId(currentUserId) })
          .project({ following_id: 1 })
          .toArray()

        followedUserIds = follows.map(f => f.following_id)
      }

      // 2. Build Base Match Query
      const matchQuery: any = {
        is_archived: { $ne: true },
        is_deleted: { $ne: true },
        is_public: true
      }

      // Exclude own reels
      if (currentUserId && ObjectId.isValid(currentUserId)) {
        matchQuery.user_id = { $ne: new ObjectId(currentUserId) }
      }

      // 3. The "The Algorithm" Aggregation Pipeline
      const pipeline: any[] = [
        { $match: matchQuery },

        // --- Feature Extraction ---

        // Lookup Creator
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

        // Count Likes (Real-time signal)
        {
          $lookup: {
            from: 'likes',
            let: { reelId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$post_id', '$$reelId'] } } },
              { $count: 'count' }
            ],
            as: 'likes_info'
          }
        },

        // Count Comments (Real-time signal)
        {
          $lookup: {
            from: 'comments',
            let: { reelId: '$_id' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$post_id', '$$reelId'] }, { $eq: ['$is_deleted', false] }] } } },
              { $count: 'count' }
            ],
            as: 'comments_info'
          }
        },

        // Check Relationship (Is current user following creator?)
        {
          $addFields: {
            // Check if creator's ID is in our followedUserIds list
            is_following_creator: {
              $in: ['$user_id', followedUserIds]
            }
          }
        },

        // Check if Liked by current user
        {
          $lookup: {
            from: 'likes',
            let: { reelId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$post_id', '$$reelId'] },
                      { $eq: ['$user_id', currentUserId ? new ObjectId(currentUserId) : null] }
                    ]
                  }
                }
              }
            ],
            as: 'user_like'
          }
        },

        // --- Scoring Phase ---
        {
          $addFields: {
            likes_count: { $ifNull: [{ $arrayElemAt: ['$likes_info.count', 0] }, 0] },
            comments_count: { $ifNull: [{ $arrayElemAt: ['$comments_info.count', 0] }, 0] },
            is_liked: { $gt: [{ $size: '$user_like' }, 0] },

            // Interaction Score
            interaction_score: {
              $add: [
                { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$likes_info.count', 0] }, 0] }, 3] }, // Like = 3pts
                { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$comments_info.count', 0] }, 0] }, 5] }, // Comment = 5pts
                { $multiply: ['$view_count', 0.05] } // View = 0.05pts (prevent viral dominance)
              ]
            },

            // Social Score
            social_score: {
              $cond: { if: '$is_following_creator', then: 50, else: 0 } // Follow = +50pts (Huge boost for friends/followed)
            },

            // Freshness Score (Decay Factor)
            // 1000 / (Hours + 2) -> 1h old = 333, 24h old = 38, 48h old = 20
            freshness_score: {
              $divide: [
                1000,
                {
                  $add: [
                    { $divide: [{ $subtract: [new Date(), '$created_at'] }, 1000 * 60 * 60] },
                    2 // Damping factor
                  ]
                }
              ]
            }
          }
        },

        // Calculate Final Score + Randomness (Discovery)
        {
          $addFields: {
            total_score: {
              $add: [
                '$interaction_score',
                '$social_score',
                '$freshness_score',
                { $multiply: [{ $rand: {} }, 15] } // 0-15pts Random Jitter for discovery
              ]
            }
          }
        },

        // --- Sorting & Paging ---
        { $sort: { total_score: -1 } },
        { $skip: offset },
        { $limit: validLimit }
      ];

      const reels = await reelsCollection.aggregate(pipeline).toArray()

      const total = await reelsCollection.countDocuments(matchQuery);

      const transformedReels = reels.map((reel: any) => ({
        id: reel._id.toString(),
        user_id: reel.user_id.toString(),
        video_url: reel.video_url,
        thumbnail_url: reel.thumbnail_url || '',
        title: reel.title || '',
        description: reel.description || '',
        duration: reel.duration || 0,
        view_count: reel.view_count || 0,
        is_public: reel.is_public || true,
        created_at: reel.created_at,
        updated_at: reel.updated_at,
        user: {
          id: reel.user?._id?.toString() || '',
          username: reel.user?.username || '',
          full_name: reel.user?.full_name || '',
          avatar_url: reel.user?.avatar_url || '',
          is_verified: reel.user?.is_verified || false,
          is_following: reel.is_following_creator // Now correctly populated
        },
        likes_count: reel.likes_count,
        comments_count: reel.comments_count,
        is_liked: reel.is_liked,
        is_following: reel.is_following_creator // Now correctly populated
      }))

      return {
        success: true,
        data: transformedReels,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          totalPages: Math.ceil(total / validLimit),
          hasNext: validPage < Math.ceil((total + fanOutReels.length) / validLimit),
          hasPrev: validPage > 1
        }
      }
    } catch (error: any) {
      console.error('[ReelService] getReelsFeed error:', error)
      throw error
    }
  }

  // Get user's reels
  static async getUserReels(userId: string, currentUserId?: string, page = 1, limit = 20): Promise<PaginatedResponse<Reel>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const db = await getDatabase()
    const reelsCollection = db.collection('reels')

    const matchQuery = {
      user_id: new ObjectId(userId),
      is_deleted: { $ne: true }
    }

    const total = await reelsCollection.countDocuments(matchQuery)

    const reels = await reelsCollection.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { created_at: -1 } },
      { $skip: offset },
      { $limit: validLimit }
    ]).toArray()

    const transformedReels = reels.map((reel: any) => ({
      id: reel._id.toString(),
      user_id: reel.user_id.toString(),
      video_url: reel.video_url,
      thumbnail_url: reel.thumbnail_url || '',
      title: reel.title || '',
      description: reel.description || '',
      duration: reel.duration || 0,
      view_count: reel.view_count || 0,
      is_public: reel.is_public || true,
      created_at: reel.created_at,
      updated_at: reel.updated_at,
      user: {
        id: reel.user?._id?.toString() || '',
        username: reel.user?.username || '',
        full_name: reel.user?.full_name || '',
        avatar_url: reel.user?.avatar_url || '',
        is_verified: false,
        is_following: false
      },
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      is_following: false
    }))

    return {
      success: true,
      data: transformedReels,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
        hasNext: validPage < Math.ceil(total / validLimit),
        hasPrev: validPage > 1
      }
    }
  }

  // Get reel by ID
  static async getReelById(reelId: string, currentUserId?: string): Promise<Reel> {
    const db = await getDatabase()
    const reelsCollection = db.collection('reels')

    const reel = await reelsCollection.findOne({
      _id: new ObjectId(reelId),
      is_deleted: { $ne: true }
    })

    if (!reel) {
      throw errors.notFound("Reel not found")
    }

    // Get user info
    const usersCollection = db.collection('users')
    const user = await usersCollection.findOne({ _id: reel.user_id })

    return {
      id: reel._id.toString(),
      user_id: reel.user_id.toString(),
      video_url: reel.video_url,
      thumbnail_url: reel.thumbnail_url || '',
      title: reel.title || '',
      description: reel.description || '',
      duration: reel.duration || 0,
      view_count: reel.view_count || 0,
      is_public: reel.is_public || true,
      created_at: reel.created_at,
      updated_at: reel.updated_at,
      user: {
        id: user?._id?.toString() || '',
        username: user?.username || '',
        full_name: user?.full_name || '',
        avatar_url: user?.avatar_url || '',
        is_verified: user?.is_verified || false,
        is_following: false
      },
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
      is_following: false
    }
  }

  // Like reel
  static async likeReel(userId: string, reelId: string): Promise<{ liked: boolean; likes_count: number }> {
    const db = await getDatabase()
    const likesCollection = db.collection('likes')
    const reelsCollection = db.collection('reels')

    const existingLike = await likesCollection.findOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(reelId)
    })

    if (existingLike) {
      return { liked: true, likes_count: 0 }
    }

    await likesCollection.insertOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(reelId),
      created_at: new Date()
    })

    const likeCount = await likesCollection.countDocuments({ post_id: new ObjectId(reelId) })

    return { liked: true, likes_count: likeCount }
  }

  // Unlike reel
  static async unlikeReel(userId: string, reelId: string): Promise<{ liked: boolean; likes_count: number }> {
    const db = await getDatabase()
    const likesCollection = db.collection('likes')

    await likesCollection.deleteOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(reelId)
    })

    const likeCount = await likesCollection.countDocuments({ post_id: new ObjectId(reelId) })

    return { liked: false, likes_count: likeCount }
  }
  // Delete reel (soft delete)
  static async deleteReel(reelId: string, userId: string): Promise<void> {
    const db = await getDatabase();
    const reelsCollection = db.collection('reels');
    const result = await reelsCollection.updateOne(
      { _id: new ObjectId(reelId), user_id: new ObjectId(userId) },
      { $set: { is_deleted: true, updated_at: new Date() } }
    );
    if (result.matchedCount === 0) {
      throw errors.notFound('Reel not found or you are not the owner');
    }
  }

  // Toggle like/unlike reel
  static async toggleLikeReel(userId: string, reelId: string): Promise<{ liked: boolean; likes: number }> {
    const db = await getDatabase();
    const likesCollection = db.collection('likes');
    const existing = await likesCollection.findOne({ user_id: new ObjectId(userId), post_id: new ObjectId(reelId) });
    if (existing) {
      // unlike
      await likesCollection.deleteOne({ _id: existing._id });
      const count = await likesCollection.countDocuments({ post_id: new ObjectId(reelId) });
      return { liked: false, likes: count };
    } else {
      // like
      await likesCollection.insertOne({ user_id: new ObjectId(userId), post_id: new ObjectId(reelId), created_at: new Date() });
      const count = await likesCollection.countDocuments({ post_id: new ObjectId(reelId) });
      return { liked: true, likes: count };
    }
  }

  // Increment share count (soft counter)
  static async incrementShareCount(reelId: string): Promise<void> {
    const db = await getDatabase();
    const reelsCollection = db.collection('reels');
    // Use $inc on a field that may not exist yet
    await reelsCollection.updateOne({ _id: new ObjectId(reelId) }, { $inc: { share_count: 1 }, $set: { updated_at: new Date() } });
  }

  // Get reel likes with pagination
  static async getReelLikes(reelId: string, page = 1, limit = 20): Promise<PaginatedResponse<any>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString());
    const offset = pagination.getOffset(validPage, validLimit);
    const db = await getDatabase();
    const likesCollection = db.collection('likes');
    const total = await likesCollection.countDocuments({ post_id: new ObjectId(reelId) });
    const likes = await likesCollection.aggregate([
      { $match: { post_id: new ObjectId(reelId) } },
      { $sort: { created_at: -1 } },
      { $skip: offset },
      { $limit: validLimit },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          id: '$user._id',
          username: '$user.username',
          full_name: '$user.full_name',
          avatar_url: '$user.avatar_url',
          liked_at: '$created_at'
        }
      }
    ]).toArray();
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total);
    return { success: true, data: likes, pagination: paginationMeta };
  }
}

