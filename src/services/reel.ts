import { getDatabase, cache } from "../lib/database"
import { StorageService } from "../lib/storage"
import type { Reel, CreateReelRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors } from "../lib/utils"
import { ObjectId } from "mongodb"

export class ReelService {
  // Create reel
  static async createReel(userId: string, reelData: CreateReelRequest): Promise<Reel> {
    const { video_url, thumbnail_url, title, description, duration } = reelData

    if (!video_url) {
      throw errors.badRequest("Video URL is required for reels")
    }

    if (title && title.length > 255) {
      throw errors.badRequest("Title too long (max 255 characters)")
    }

    if (description && description.length > 2200) {
      throw errors.badRequest("Description too long (max 2200 characters)")
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
      thumbnail_url: thumbnail_url || null,
      title: title || null,
      description: description || null,
      duration: duration || 0,
      view_count: 0,
      is_public: true,
      created_at: reelDoc.created_at,
      updated_at: reelDoc.updated_at,
      user: {
        id: user._id.toString(),
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified || false,
      },
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
    }
  }

  // Get reel by ID
  static async getReelById(reelId: string, currentUserId?: string): Promise<Reel> {
    const db = await getDatabase()
    const reelsCollection = db.collection('reels')
    const usersCollection = db.collection('users')
    const likesCollection = db.collection('likes')
    const commentsCollection = db.collection('comments')

    const reel = await reelsCollection.findOne({
      _id: new ObjectId(reelId),
      is_deleted: { $ne: true }
    })

    if (!reel) {
      throw errors.notFound("Reel not found")
    }

    // Get user data
    const user = await usersCollection.findOne({ _id: reel.user_id })

    if (!user) {
      throw errors.notFound("User not found")
    }

    // Get likes and comments count
    const likesCount = await likesCollection.countDocuments({ post_id: reel._id })
    const commentsCount = await commentsCollection.countDocuments({
      post_id: reel._id,
      is_deleted: { $ne: true }
    })

    // Check if current user liked
    let is_liked = false
    if (currentUserId) {
      const like = await likesCollection.findOne({
        user_id: new ObjectId(currentUserId),
        post_id: reel._id
      })
      is_liked = !!like
    }

    return {
      id: reel._id.toString(),
      user_id: reel.user_id.toString(),
      video_url: reel.video_url,
      thumbnail_url: reel.thumbnail_url,
      title: reel.title,
      description: reel.description,
      duration: reel.duration,
      view_count: reel.view_count || 0,
      is_public: reel.is_public,
      created_at: reel.created_at,
      updated_at: reel.updated_at,
      user: {
        id: user._id.toString(),
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified || false,
      },
      likes_count: likesCount,
      comments_count: commentsCount,
      is_liked
    }
  }

  // Get user's reels
  static async getUserReels(
    userId: string,
    currentUserId?: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<Reel>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const db = await getDatabase()
    const reelsCollection = db.collection('reels')
    const usersCollection = db.collection('users')
    const likesCollection = db.collection('likes')
    const commentsCollection = db.collection('comments')

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
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'likes',
          let: { reelId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$post_id', '$$reelId'] } } }
          ],
          as: 'likes'
        }
      },
      {
        $lookup: {
          from: 'comments',
          let: { reelId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$post_id', '$$reelId'] },
                is_deleted: { $ne: true }
              }
            }
          ],
          as: 'comments'
        }
      },
      {
        $addFields: {
          likes_count: { $size: '$likes' },
          comments_count: { $size: '$comments' }
        }
      },
      { $sort: { created_at: -1 } },
      { $skip: offset },
      { $limit: validLimit },
      {
        $project: {
          likes: 0,
          comments: 0
        }
      }
    ]).toArray()

    const transformedReels = await Promise.all(
      reels.map(async (reel) => {
        let is_liked = false

        if (currentUserId) {
          const like = await likesCollection.findOne({
            user_id: new ObjectId(currentUserId),
            post_id: reel._id
          })
          is_liked = !!like
        }

        return {
          id: reel._id.toString(),
          user_id: reel.user_id.toString(),
          video_url: reel.video_url,
          thumbnail_url: reel.thumbnail_url,
          title: reel.title,
          description: reel.description,
          duration: reel.duration,
          view_count: reel.view_count || 0,
          is_public: reel.is_public,
          created_at: reel.created_at,
          updated_at: reel.updated_at,
          user: {
            id: reel.user._id.toString(),
            username: reel.user.username,
            full_name: reel.user.full_name,
            avatar_url: reel.user.avatar_url,
            is_verified: reel.user.is_verified || false,
          },
          likes_count: reel.likes_count,
          comments_count: reel.comments_count,
          is_liked
        } as Reel
      })
    )

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: transformedReels,
      pagination: paginationMeta,
    }
  }

  // Get reels feed (discover/explore)
  static async getReelsFeed(currentUserId?: string, page = 1, limit = 20): Promise<PaginatedResponse<Reel>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    console.log('[ReelService] getReelsFeed called with:', { currentUserId, page, limit })

    const db = await getDatabase()
    const reelsCollection = db.collection('reels')
    const likesCollection = db.collection('likes')

    // Build match query - exclude current user's reels if userId provided
    // Note: Using is_archived instead of is_deleted to match actual schema
    const matchQuery: any = {
      is_archived: { $ne: true }
    }

    if (currentUserId) {
      matchQuery.user_id = { $ne: new ObjectId(currentUserId) }
    }

    console.log('[ReelService] Match query:', matchQuery)

    // Get total count
    const total = await reelsCollection.countDocuments(matchQuery)
    console.log('[ReelService] Total reels found with filters:', total)

    // Aggregate reels with user info, likes, and comments count
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
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'likes',
          let: { reelId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$post_id', '$$reelId'] } } }
          ],
          as: 'likes'
        }
      },
      {
        $lookup: {
          from: 'comments',
          let: { reelId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$post_id', '$$reelId'] },
                is_deleted: { $ne: true }
              }
            }
          ],
          as: 'comments'
        }
      },
      {
        $addFields: {
          likes_count: { $size: '$likes' },
          comments_count: { $size: '$comments' },
          // Scoring algorithm for feed ranking
          score: {
            $add: [
              // Recency factor (newer = higher score)
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: [new Date(), '$created_at'] },
                      3600000 // milliseconds to hours
                    ]
                  },
                  -0.1
                ]
              },
              // View count factor
              { $multiply: [{ $divide: [{ $ifNull: ['$view_count', 0] }, 1000] }, 0.3] },
              // Likes factor
              { $multiply: [{ $size: '$likes' }, 0.5] },
              // Comments factor
              { $multiply: [{ $size: '$comments' }, 0.3] }
            ]
          }
        }
      },
      { $sort: { score: -1, created_at: -1 } },
      { $skip: offset },
      { $limit: validLimit },
      {
        $project: {
          likes: 0,
          comments: 0
        }
      }
    ]).toArray()

    // Transform to Reel type and check if current user liked each reel
    const transformedReels = await Promise.all(
      reels.map(async (reel) => {
        let is_liked = false

        if (currentUserId) {
          const like = await likesCollection.findOne({
            user_id: new ObjectId(currentUserId),
            post_id: reel._id
          })
          is_liked = !!like
        }

        return {
          id: reel._id.toString(),
          user_id: reel.user_id.toString(),
          video_url: reel.video_url,
          thumbnail_url: reel.thumbnail_url,
          title: reel.title || null,
          description: reel.caption || reel.description || '',
          duration: reel.duration || 0,
          view_count: reel.views_count || reel.view_count || 0,
          is_public: true, // Default to true since field doesn't exist in schema
          created_at: reel.created_at,
          updated_at: reel.updated_at,
          user: {
            id: reel.user._id.toString(),
            username: reel.user.username,
            full_name: reel.user.full_name,
            avatar_url: reel.user.avatar_url,
            is_verified: reel.user.is_verified || false,
          },
          likes_count: reel.likes_count,
          comments_count: reel.comments_count,
          is_liked
        } as Reel
      })
    )

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    console.log('[ReelService] Returning', transformedReels.length, 'reels')

    return {
      success: true,
      data: transformedReels,
      pagination: paginationMeta,
    }
  }

  // Delete reel
  static async deleteReel(reelId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    const reelsCollection = db.collection('reels')

    const reel = await reelsCollection.findOne({
      _id: new ObjectId(reelId)
    })

    if (!reel) {
      throw errors.notFound("Reel not found")
    }

    if (reel.user_id.toString() !== userId) {
      throw errors.forbidden("You can only delete your own reels")
    }

    // Soft delete
    await reelsCollection.updateOne(
      { _id: new ObjectId(reelId) },
      {
        $set: {
          is_deleted: true,
          updated_at: new Date()
        }
      }
    )

    // Clear cache
    await cache.del(`reel:${reelId}`)
  }

  // Like reel
  static async likeReel(userId: string, reelId: string): Promise<void> {
    const db = await getDatabase()
    const reelsCollection = db.collection('reels')
    const likesCollection = db.collection('likes')

    const reel = await reelsCollection.findOne({
      _id: new ObjectId(reelId),
      is_public: true,
      is_deleted: { $ne: true }
    })

    if (!reel) {
      throw errors.notFound("Reel not found")
    }

    const existingLike = await likesCollection.findOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(reelId)
    })

    if (existingLike) {
      throw errors.conflict("Reel already liked")
    }

    await likesCollection.insertOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(reelId),
      created_at: new Date()
    })

    await cache.del(`reel:${reelId}`)
  }

  // Unlike reel
  static async unlikeReel(userId: string, reelId: string): Promise<void> {
    const db = await getDatabase()
    const likesCollection = db.collection('likes')

    const result = await likesCollection.deleteOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(reelId)
    })

    if (result.deletedCount === 0) {
      throw errors.notFound("Like not found")
    }

    await cache.del(`reel:${reelId}`)
  }

  // Get reel likes
  static async getReelLikes(reelId: string, page = 1, limit = 20): Promise<PaginatedResponse<any>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const db = await getDatabase()
    const likesCollection = db.collection('likes')

    const total = await likesCollection.countDocuments({ post_id: new ObjectId(reelId) })

    const likes = await likesCollection.aggregate([
      { $match: { post_id: new ObjectId(reelId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { created_at: -1 } },
      { $skip: offset },
      { $limit: validLimit },
      {
        $project: {
          id: '$user._id',
          username: '$user.username',
          full_name: '$user.full_name',
          avatar_url: '$user.avatar_url',
          is_verified: '$user.is_verified',
          liked_at: '$created_at'
        }
      }
    ]).toArray()

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: likes,
      pagination: paginationMeta,
    }
  }
}
