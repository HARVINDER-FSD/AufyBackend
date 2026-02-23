import { getDatabase } from "../lib/database"
import type { Post, CreatePostRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { ObjectId } from "mongodb"
import { maskAnonymousUser } from "../lib/anonymous-utils"
import { addJob, QUEUE_NAMES, isQueueAvailable } from "../lib/queue"
import { cacheGet, cacheSet, cacheDel, cacheLLen, cacheLRange } from "../lib/redis"
import { logger } from "../middleware/logger"

export class PostService {
  // Create new post
  static async createPost(userId: string, postData: CreatePostRequest): Promise<Post> {
    const { content, media_urls, media_type, location } = postData

    // Validate post data
    if (!content && (!media_urls || media_urls.length === 0)) {
      throw errors.badRequest("Post must have content or media")
    }

    if (content && content.length > 2200) {
      throw errors.badRequest("Post content too long (max 2200 characters)")
    }

    if (media_urls && media_urls.length > 10) {
      throw errors.badRequest("Maximum 10 media files per post")
    }

    const db = await getDatabase()
    const postsCollection = db.collection('posts')
    const usersCollection = db.collection('users')

    // Optimized: Check cache first
    const cacheKey = `${cacheKeys.user(userId)}:profile`
    let user: any = await cacheGet(cacheKey);

    if (!user) {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    }

    if (!user) {
      throw errors.notFound("User not found")
    }

    const postDoc = {
      user_id: new ObjectId(userId),
      content: content || null,
      media_urls: media_urls || null,
      media_type: media_type || 'text',
      location: location || null,
      is_archived: false,
      is_anonymous: user.isAnonymousMode === true,
      created_at: new Date(),
      updated_at: new Date(),
      likes_count: 0,
      comments_count: 0,
    }

    const result = await postsCollection.insertOne(postDoc)

    // Invalidate user posts cache (first page)
    await cacheDel(cacheKeys.userPosts(userId, 1, 20))

    const postWithUser: Post = {
      id: result.insertedId.toString(),
      user_id: userId,
      content: postDoc.content || undefined,
      media_urls: postDoc.media_urls || undefined,
      media_type: postDoc.media_type as any,
      location: postDoc.location || undefined,
      is_archived: postDoc.is_archived,
      created_at: postDoc.created_at,
      updated_at: postDoc.updated_at,
      user: maskAnonymousUser({ ...user, is_anonymous: postDoc.is_anonymous, anonymousPersona: user.anonymousPersona }),
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
    }

    return postWithUser
  }

  // Get Anonymous Trending Feed (Verified Creators Only)
  static async getAnonymousTrendingFeed(currentUserId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<Post>> {
    // Try to get from cache first (just the raw posts and total count)
    const cacheKey = cacheKeys.anonymousTrending(page, limit)
    const cachedData = await cacheGet(cacheKey)

    let posts: any[] = []
    let total = 0

    const db = await getDatabase()

    if (cachedData) {
      posts = cachedData.posts
      total = cachedData.total
    } else {
      const postsCollection = db.collection('posts')
      const usersCollection = db.collection('users')

      // Calculate skip
      const skip = (page - 1) * limit

      // Optimization: Get verified user IDs first to avoid expensive $lookup on all posts
      // This dramatically reduces the workload for the database
      const verifiedUsers = await usersCollection.find(
        {
          $or: [
            { is_verified: true },
            { badge_type: { $in: ['blue', 'gold', 'purple'] } }
          ],
          is_active: true
        },
        { projection: { _id: 1 } }
      ).toArray()

      const verifiedUserIds = verifiedUsers.map(u => u._id)

      // If no verified users, return empty result early
      if (verifiedUserIds.length === 0) {
        return {
          success: true,
          data: [],
          pagination: pagination.getMetadata(page, limit, 0)
        }
      }

      const matchQuery = {
        is_archived: { $ne: true },
        is_deleted: { $ne: true },
        user_id: { $in: verifiedUserIds }
      }

      // Get total count for pagination
      total = await postsCollection.countDocuments(matchQuery)

      // Pipeline to sort by engagement and paginate
      const pipeline = [
        { $match: matchQuery },
        {
          // Add a field for engagement score
          $addFields: {
            engagementScore: { $add: [{ $ifNull: ['$likes_count', 0] }, { $multiply: [{ $ifNull: ['$comments_count', 0] }, 2] }] } // Comments weighted x2
          }
        },
        {
          $sort: { engagementScore: -1, created_at: -1 } // Highest engagement first
        },
        {
          $skip: skip
        },
        {
          $limit: limit
        },
        // Lookup author only for the paginated results
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'author'
          }
        },
        {
          $unwind: '$author'
        }
      ]

      posts = await postsCollection.aggregate(pipeline).toArray()

      // Cache the raw results for 60 seconds
      await cacheSet(cacheKey, { posts, total }, 60)
    }

    // Enrich posts with current user's interaction status (even if they are anonymous, they might have liked it)
    // Note: enrichPosts expects the 'author' to be on the post object if possible, but it fetches likes separately.
    // The aggregate above attaches 'author'. We should make sure enrichPosts handles it or we format it correctly.
    // Based on previous code, enrichPosts fetches users if needed.
    // However, our aggregate already has the user (author). Let's prepare the posts for enrichPosts.

    // We need to re-map the 'author' from lookup back to how enrichPosts expects it (or just let enrichPosts handle it if it does).
    // Let's look at enrichPosts implementation again. It seems it doesn't fetch users inside it? 
    // Wait, I didn't see the full enrichPosts code. Let's assume it handles "user" field or we need to attach it.
    // Actually, let's just manually format the posts here to be safe and efficient since we already have the author.

    const enrichedPosts: Post[] = []

    // Helper to get likes status for the current user
    const likesCollection = db.collection('likes')
    let likedPostIds = new Set<string>()
    if (currentUserId) {
      // Need to convert string IDs from cache back to ObjectId if needed, but here we just compare strings usually
      // MongoDB driver returns ObjectId. JSON.parse returns string.
      // We should map posts to get IDs.
      const postIds = posts.map(p => new ObjectId(p._id))

      const likes = await likesCollection.find({
        user_id: new ObjectId(currentUserId),
        post_id: { $in: postIds }
      }).toArray()
      likes.forEach(like => likedPostIds.add(like.post_id.toString()))
    }

    for (const post of posts) {
      const author = post.author

      // Mask author if THEY are anonymous (unlikely for verified creators, but good practice)
      const displayUser = maskAnonymousUser({ ...author, is_anonymous: post.is_anonymous })

      enrichedPosts.push({
        id: post._id.toString(),
        user_id: post.user_id.toString(),
        content: post.content,
        media_urls: post.media_urls,
        media_type: post.media_type as any,
        location: post.location || undefined,
        is_archived: post.is_archived,
        created_at: post.created_at, // Date string if from cache, Date object if from DB
        updated_at: post.updated_at,
        user: displayUser as any,
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        is_liked: likedPostIds.has(post._id.toString())
      })
    }

    return {
      success: true,
      data: enrichedPosts,
      pagination: pagination.getMetadata(page, limit, total)
    }
  }

  // Get post by ID
  static async getPostById(postId: string, currentUserId?: string): Promise<Post> {
    const db = await getDatabase()
    const postsCollection = db.collection('posts')
    const usersCollection = db.collection('users')
    const likesCollection = db.collection('likes')
    const commentsCollection = db.collection('comments')

    const post = await postsCollection.findOne({
      _id: new ObjectId(postId),
      is_archived: { $ne: true }
    })

    if (!post) {
      throw errors.notFound("Post not found")
    }

    // Get user data
    const user = await usersCollection.findOne({ _id: post.user_id })

    if (!user) {
      throw errors.notFound("User not found")
    }

    // Get likes and comments count
    // Use stored counts if available, fallback to countDocuments
    const likesCount = post.likes_count !== undefined ? post.likes_count : await likesCollection.countDocuments({ post_id: post._id })
    const commentsCount = post.comments_count !== undefined ? post.comments_count : await commentsCollection.countDocuments({
      post_id: post._id,
      is_deleted: { $ne: true }
    })

    // Check if current user liked
    let is_liked = false
    let userReaction = null
    if (currentUserId) {
      const like = await likesCollection.findOne({
        user_id: new ObjectId(currentUserId),
        post_id: post._id
      })
      is_liked = !!like
      userReaction = like?.reaction
    }

    // Get reaction summary
    // Single post view - we definitely need reactions
    const reactionSummary = await likesCollection.aggregate([
      { $match: { post_id: post._id } },
      {
        $group: {
          _id: '$reaction',
          count: { $sum: 1 }
        }
      }
    ]).toArray()

    const reactions: { [emoji: string]: number } = {}
    reactionSummary.forEach((item: any) => {
      if (item._id) {
        reactions[item._id] = item.count
      }
    })

    return {
      id: post._id.toString(),
      user_id: post.user_id.toString(),
      content: post.content,
      media_urls: post.media_urls,
      media_type: post.media_type,
      location: post.location,
      is_archived: post.is_archived,
      created_at: post.created_at,
      updated_at: post.updated_at,
      user: maskAnonymousUser({ ...user, is_anonymous: post.is_anonymous }),
      likes_count: likesCount,
      comments_count: commentsCount,
      is_liked,
      userReaction,
      reactions
    }
  }

  // Helper to enrich posts with user info, likes, reactions, etc. efficiently
  private static async enrichPosts(posts: any[], currentUserId?: string, includeReactionSummary: boolean = false): Promise<Post[]> {
    if (posts.length === 0) return []

    const db = await getDatabase()
    const likesCollection = db.collection('likes')

    const postIds = posts.map(p => p._id)
    const userId = currentUserId ? new ObjectId(currentUserId) : null

    // 1. Batch fetch user likes (if logged in)
    let likedPostIds = new Set<string>()
    let userReactions = new Map<string, string>()

    if (userId) {
      // Optimize: Only fetch necessary fields
      const likes = await likesCollection.find(
        { user_id: userId, post_id: { $in: postIds } },
        { projection: { post_id: 1, reaction: 1 } }
      ).toArray()

      likes.forEach(like => {
        likedPostIds.add(like.post_id.toString())
        if (like.reaction) {
          userReactions.set(like.post_id.toString(), like.reaction)
        }
      })
    }

    // 2. Batch fetch reaction summaries (Only if requested - Expensive operation)
    const reactionsMap = new Map<string, Record<string, number>>()

    if (includeReactionSummary) {
      const reactionSummaries = await likesCollection.aggregate([
        { $match: { post_id: { $in: postIds } } },
        {
          $group: {
            _id: { post_id: '$post_id', reaction: '$reaction' },
            count: { $sum: 1 }
          }
        }
      ]).toArray()

      reactionSummaries.forEach((item: any) => {
        const postId = item._id.post_id.toString()
        const reaction = item._id.reaction || '❤️'
        if (!reactionsMap.has(postId)) {
          reactionsMap.set(postId, {})
        }
        reactionsMap.get(postId)![reaction] = item.count
      })
    }

    // 3. Map everything back
    return posts.map(post => {
      const postId = post._id.toString()
      const isLiked = likedPostIds.has(postId)

      return {
        id: postId,
        user_id: post.user_id.toString(),
        content: post.content,
        media_urls: post.media_urls,
        media_type: post.media_type,
        location: post.location,
        is_archived: post.is_archived,
        created_at: post.created_at,
        updated_at: post.updated_at,
        user: maskAnonymousUser({ ...post.user, is_anonymous: post.is_anonymous }),

        // Use stored counts if available, otherwise 0
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,

        is_liked: isLiked,
        userReaction: userReactions.get(postId) || null,
        reactions: reactionsMap.get(postId) || {}, // Empty if not requested
        likedBy: []
      } as Post
    })
  }

  // Get user's posts
  static async getUserPosts(
    userId: string,
    currentUserId?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Post>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    // Try cache first
    const cacheKey = cacheKeys.userPosts(userId, validPage, validLimit)
    const cachedData = await cacheGet(cacheKey)

    let posts: any[] = []
    let total = 0

    const db = await getDatabase()

    if (cachedData) {
      posts = cachedData.posts
      total = cachedData.total
    } else {
      const postsCollection = db.collection('posts')

      const matchQuery = {
        user_id: new ObjectId(userId),
        is_archived: { $ne: true }
      }

      // Get total count for pagination
      total = await postsCollection.countDocuments(matchQuery)

      // Pipeline
      posts = await postsCollection.aggregate([
        { $match: matchQuery },
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
        { $unwind: '$user' }
      ]).toArray()

      // Cache raw data
      await cacheSet(cacheKey, { posts, total }, 60)
    }

    // Ensure dates are Date objects for enrichPosts if needed, or rely on enrichPosts handling it
    // To be safe, let's map dates back to objects if they are strings
    if (cachedData) {
      posts = posts.map(p => ({
        ...p,
        created_at: new Date(p.created_at),
        updated_at: new Date(p.updated_at),
        _id: new ObjectId(p._id), // enrichPosts might expect ObjectId for _id if it calls toString()
        user_id: new ObjectId(p.user_id)
      }))
    }

    const transformedPosts = await PostService.enrichPosts(posts, currentUserId, true) // Need reactions for user profile posts

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: transformedPosts,
      pagination: paginationMeta,
    }
  }

  // --- MOOD & PERSONALIZATION ENGINE ---

  // 1. Detect User Mood (Interests based on recent activity)
  static async getUserMood(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const likesCollection = db.collection('likes')
    const postsCollection = db.collection('posts')

    // Get last 50 liked posts (Recent Mood)
    const recentLikes = await likesCollection.find(
      { user_id: new ObjectId(userId) },
      { sort: { created_at: -1 }, limit: 50 }
    ).toArray()

    if (recentLikes.length === 0) return []

    const postIds = recentLikes.map(l => l.post_id)

    // Get the posts to extract hashtags/topics
    const likedPosts = await postsCollection.find(
      { _id: { $in: postIds } },
      { projection: { hashtags: 1, media_type: 1 } }
    ).toArray()

    // Frequency Analysis
    const tagFrequency: Record<string, number> = {}

    likedPosts.forEach(post => {
      if (post.hashtags && Array.isArray(post.hashtags)) {
        post.hashtags.forEach((tag: string) => {
          const lowerTag = tag.toLowerCase()
          tagFrequency[lowerTag] = (tagFrequency[lowerTag] || 0) + 1
        })
      }
    })

    // Sort by frequency
    const sortedTags = Object.entries(tagFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Top 5 Mood Tags
      .map(([tag]) => tag)

    return sortedTags
  }

  // 2. Get Suggested Posts (Based on Mood)
  static async getSuggestedPosts(userId: string, moodTags: string[], excludeIds: string[] = [], limit = 5): Promise<any[]> {
    if (moodTags.length === 0) return []

    const db = await getDatabase()
    const postsCollection = db.collection('posts')

    // Find popular posts with these tags (excluding own posts and already seen)
    const suggestions = await postsCollection.aggregate([
      {
        $match: {
          hashtags: { $in: moodTags },
          user_id: { $ne: new ObjectId(userId) },
          _id: { $nin: excludeIds.map(id => new ObjectId(id)) },
          is_archived: { $ne: true },
          is_deleted: { $ne: true }
        }
      },
      // Boost by engagement (Quality Filter)
      {
        $addFields: {
          score: {
            $add: [
              { $ifNull: ['$likes_count', 0] },
              { $multiply: [{ $ifNull: ['$comments_count', 0] }, 2] }
            ]
          }
        }
      },
      { $sort: { score: -1, created_at: -1 } },
      { $limit: limit },
      // Lookup Author
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: '$author' }
    ]).toArray()

    return suggestions.map(post => ({
      ...post,
      is_suggested: true, // Flag for UI
      suggested_reason: `Because you like #${moodTags[0]}`
    }))
  }

  // Get feed posts
  static async getFeedPosts(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<Post>> {
    const startTime = Date.now();
    // 🚀 Cache Strategy for Main Feed
    const cacheKey = cacheKeys.userFeed(userId, page, limit);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.debug(`[Perf] Feed Cache Hit: ${Date.now() - startTime}ms`, { userId, page });
      return cached;
    }

    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const db = await getDatabase()
    const postsCollection = db.collection('posts')

    // --- FAN-OUT READ STRATEGY (Hybrid) ---
    // Try to read from Redis List first (Makhan Mode)
    const listKey = `feed:${userId}:list`;
    const listLen = await cacheLLen(listKey);

    let rawPosts: any[] = [];
    let total = 0;
    let isFanOutHit = false;

    if (listLen > 0) {
      // We have a feed list!
      const start = offset;
      const stop = offset + validLimit - 1;
      const postIds = await cacheLRange(listKey, start, stop);

      if (postIds.length > 0) {
        logger.debug(`[Perf] Feed Fan-out Hit: ${postIds.length} items from list`);

        const objectIds = postIds.map(id => new ObjectId(id));

        // Fetch posts by ID (Point Query - Very Fast)
        const tList = Date.now();
        const fetchedPosts = await postsCollection.find({ _id: { $in: objectIds } }).toArray();
        logger.debug(`[Perf] Fan-out DB Fetch: ${Date.now() - tList}ms`);

        // Re-order based on list order (MongoDB $in does not preserve order)
        const postMap = new Map(fetchedPosts.map(p => [p._id.toString(), p]));
        rawPosts = postIds.map(id => postMap.get(id)).filter(p => p); // Filter nulls

        total = listLen; // Approximate total from list (capped at 500 usually)
        isFanOutHit = true;
      }
    }

    // Fallback to Pull Model if list is empty (Cold Start / Old Users)
    if (!isFanOutHit) {
      logger.debug(`[Perf] Feed Fan-out Miss/Empty - Fallback to Pull Model`);
      const followsCollection = db.collection('follows')

      // Get users that current user follows (check both field formats)
      const t1 = Date.now();
      const followsCacheKey = `user:following_ids:${userId}`;
      let followingIds: string[] | null = await cacheGet(followsCacheKey);

      if (!followingIds) {
        const follows = await followsCollection.find({
          $or: [
            { follower_id: new ObjectId(userId) },
            { followerId: new ObjectId(userId) }
          ],
          status: 'accepted' // Only accepted follows
        }).toArray()

        followingIds = follows.map(f => (f.following_id || f.followingId).toString())
        followingIds.push(userId) // Include own posts

        // Cache following list for 5 minutes
        await cacheSet(followsCacheKey, followingIds, 300);
      }
      logger.debug(`[Perf] Fetch Following IDs: ${Date.now() - t1}ms`, { count: followingIds.length });

      const followingObjectIds = followingIds.map(id => new ObjectId(id))

      const matchQuery = {
        user_id: { $in: followingObjectIds },
        is_archived: { $ne: true }
      }

      const t2 = Date.now();
      total = await postsCollection.countDocuments(matchQuery)
      logger.debug(`[Perf] Count Documents: ${Date.now() - t2}ms`);

      // Optimization: Use find() + manual join instead of expensive aggregate $lookup
      const t3 = Date.now();
      rawPosts = await postsCollection.find(matchQuery)
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(validLimit)
        .toArray();
      logger.debug(`[Perf] Fetch Raw Posts: ${Date.now() - t3}ms`);
    }

    // Collect user IDs to fetch in bulk
    const userIds = [...new Set(rawPosts.map(p => p.user_id))];
    const usersCollection = db.collection('users');

    const t4 = Date.now();
    const users = await usersCollection.find(
      {
        _id: { $in: userIds },
        is_active: true
      },
      { projection: { _id: 1, username: 1, name: 1, full_name: 1, avatar: 1, avatar_url: 1, is_verified: 1, badge_type: 1, verification_type: 1, isAnonymousMode: 1, anonymousPersona: 1 } }
    ).toArray();
    logger.debug(`[Perf] Fetch Users: ${Date.now() - t4}ms`);

    // Map users for quick lookup
    const userMap = new Map<string, any>();
    users.forEach(u => userMap.set(u._id.toString(), u));

    // Attach users to posts and filter out missing authors (shadow banned)
    let posts = rawPosts.map(post => {
      const user = userMap.get(post.user_id.toString());
      return {
        ...post,
        author: user // Mimic the structure expected by enrichPosts or internal logic
      };
    }).filter(post => post.author); // 🛡️ Filter out posts from shadow-banned users

    // --- ALGORITHM INJECTION: Mix in "Mood" Suggestions ---
    // Only on first few pages to spark interest
    if (page <= 2) {
      try {
        const moodTags = await PostService.getUserMood(userId)
        if (moodTags.length > 0) {
          const currentPostIds = posts.map(p => p._id.toString())
          const suggestions = await PostService.getSuggestedPosts(userId, moodTags, currentPostIds, 4) // Fetch 4 suggestions

          if (suggestions.length > 0) {
            // Interleave suggestions: Insert 1 suggestion every 4 posts
            // [F, F, F, F, S, F, F, F, F, S, ...]
            const mixedPosts = []
            let sIdx = 0

            for (let i = 0; i < posts.length; i++) {
              mixedPosts.push(posts[i])
              // Insert suggestion after every 4th post
              if ((i + 1) % 4 === 0 && sIdx < suggestions.length) {
                mixedPosts.push(suggestions[sIdx])
                sIdx++
              }
            }

            // Add remaining suggestions if feed is short
            while (sIdx < suggestions.length) {
              mixedPosts.push(suggestions[sIdx])
              sIdx++
            }

            posts = mixedPosts
          }
        }
      } catch (err) {
        logger.error('Error injecting mood suggestions:', err)
        // Fail silently, return normal feed
      }
    }

    // Note: enrichPosts handles the final transformation, including masking anonymous users.
    // However, enrichPosts previously expected 'user' field populated from aggregation.
    // Let's modify posts to have 'user' field as expected.
    posts.forEach((p: any) => { p.user = p.author; });

    // Optimize: Skip reaction summary for feed (saves aggregation cost)
    const t5 = Date.now();
    const transformedPosts = await PostService.enrichPosts(posts, userId, false)
    logger.debug(`[Perf] Enrich Posts: ${Date.now() - t5}ms`);

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    const result = {
      success: true,
      data: transformedPosts,
      pagination: paginationMeta,
    }

    // Cache for 60 seconds
    await cacheSet(cacheKey, result, 60);
    logger.info(`[Perf] Total Feed Time: ${Date.now() - startTime}ms`, { userId, postCount: transformedPosts.length });

    return result;
  }

  // Update post
  static async updatePost(postId: string, userId: string, updates: Partial<CreatePostRequest>): Promise<Post> {
    const allowedFields = ["content", "location"]
    const updateFields = Object.keys(updates).filter((key) => allowedFields.includes(key))

    if (updateFields.length === 0) {
      throw errors.badRequest("No valid fields to update")
    }

    if (updates.content && updates.content.length > 2200) {
      throw errors.badRequest("Post content too long (max 2200 characters)")
    }

    const db = await getDatabase()
    const postsCollection = db.collection('posts')
    const usersCollection = db.collection('users')

    const updateDoc: any = {
      updated_at: new Date()
    }

    updateFields.forEach(field => {
      updateDoc[field] = updates[field as keyof CreatePostRequest]
    })

    const result = await postsCollection.findOneAndUpdate(
      {
        _id: new ObjectId(postId),
        user_id: new ObjectId(userId),
        is_archived: { $ne: true }
      },
      { $set: updateDoc },
      { returnDocument: 'after' }
    )

    if (!result) {
      throw errors.notFound("Post not found or you don't have permission to update it")
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) })

    // Invalidate user posts cache (first page)
    await cacheDel(cacheKeys.userPosts(userId, 1, 20))

    return {
      id: result._id.toString(),
      user_id: result.user_id.toString(),
      content: result.content,
      media_urls: result.media_urls,
      media_type: result.media_type,
      location: result.location,
      is_archived: result.is_archived,
      created_at: result.created_at,
      updated_at: result.updated_at,
      user: {
        id: user!._id.toString(),
        username: user!.username,
        full_name: user!.full_name,
        avatar_url: user!.avatar_url,
        is_verified: user!.is_verified || false,
        badge_type: user!.badge_type || user!.verification_type || null,
      },
      likes_count: result.likes_count || 0,
      comments_count: result.comments_count || 0,
      is_liked: false
    }
  }

  // Delete post
  static async deletePost(postId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    const postsCollection = db.collection('posts')

    const post = await postsCollection.findOne({
      _id: new ObjectId(postId),
      is_archived: { $ne: true }
    })

    if (!post) {
      throw errors.notFound("Post not found")
    }

    if (post.user_id.toString() !== userId) {
      throw errors.forbidden("You don't have permission to delete this post. Only the post owner can delete it.")
    }

    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $set: { is_archived: true, updated_at: new Date() } }
    )

    // Invalidate user posts cache (first page)
    await cacheDel(cacheKeys.userPosts(userId, 1, 20))
  }

  // Like post
  static async likePost(userId: string, postId: string, is_anonymous: boolean = false): Promise<void> {
    // 🚀 Async Like Optimization for Million-User Scale
    // Push to queue immediately for instant response
    // A background worker will handle the DB write

    // 1. Check if queue is available
    const queueAvailable = await isQueueAvailable();
    if (queueAvailable) {
      logger.debug('⚡ Using Async Like Queue', { userId, postId, action: 'like' });
      await addJob(QUEUE_NAMES.LIKES, 'process-like', {
        userId,
        postId,
        is_anonymous,
        action: 'like',
        timestamp: new Date()
      });
      return; // Return immediately!
    } else {
      logger.warn('⚠️ Async Like Queue Unavailable - Falling back to sync DB write');
    }

    // Fallback to synchronous DB write if queue is down
    const db = await getDatabase()
    const postsCollection = db.collection('posts')
    const likesCollection = db.collection('likes')

    // Optimistic Like: Try to insert directly. Unique index prevents duplicates.
    try {
      await likesCollection.insertOne({
        user_id: new ObjectId(userId),
        post_id: new ObjectId(postId),
        created_at: new Date(),
        is_anonymous: is_anonymous
      })
    } catch (error: any) {
      if (error.code === 11000) {
        throw errors.conflict("Post already liked")
      }
      throw error;
    }

    // Increment likes count on post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { likes_count: 1 } }
    )
  }

  // Unlike post
  static async unlikePost(userId: string, postId: string): Promise<void> {
    // 🚀 Async Unlike Optimization
    if (await isQueueAvailable()) {
      await addJob(QUEUE_NAMES.LIKES, 'process-like', {
        userId,
        postId,
        action: 'unlike',
        timestamp: new Date()
      });
      return;
    }

    const db = await getDatabase()
    const likesCollection = db.collection('likes')
    const postsCollection = db.collection('posts')

    const result = await likesCollection.deleteOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(postId)
    })

    if (result.deletedCount === 0) {
      throw errors.notFound("Like not found")
    }

    // Decrement likes count on post
    await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { likes_count: -1 } }
    )
  }

  // Get post likes
  static async getPostLikes(postId: string, page = 1, limit = 20): Promise<PaginatedResponse<any>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const db = await getDatabase()
    const likesCollection = db.collection('likes')

    const total = await likesCollection.countDocuments({ post_id: new ObjectId(postId) })

    const likes = await likesCollection.aggregate([
      { $match: { post_id: new ObjectId(postId) } },
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
          is_verified: '$user.is_verified',
          liked_at: '$created_at',
          is_anonymous: '$is_anonymous'
        }
      }
    ]).toArray()

    const maskedLikes = likes.map((like: any) => {
      const masked = maskAnonymousUser({
        ...like,
        _id: like.id,
        is_anonymous: like.is_anonymous
      })

      return {
        id: masked.id,
        username: masked.username,
        full_name: masked.full_name,
        avatar_url: masked.avatar_url,
        is_verified: masked.is_verified,
        liked_at: like.liked_at,
        is_anonymous: like.is_anonymous
      }
    })

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: maskedLikes,
      pagination: paginationMeta,
    }
  }
}