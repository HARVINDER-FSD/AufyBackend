import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

export class AnalyticsService {
  private static instance: AnalyticsService;
  private client: MongoClient | null = null;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async getClient(): Promise<MongoClient> {
    if (!this.client) {
      this.client = new MongoClient(MONGODB_URI);
      await this.client.connect();
    }
    return this.client;
  }

  // User analytics
  async getUserAnalytics(userId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const client = await this.getClient();
    const db = client.db();

    const startDate = this.getStartDate(period);
    const endDate = new Date();

    const [
      postsCount,
      likesReceived,
      commentsReceived,
      followersGained,
      profileViews,
      storiesCreated,
      reelsCreated
    ] = await Promise.all([
      // Posts created in period
      db.collection('posts').countDocuments({
        user_id: new ObjectId(userId),
        created_at: { $gte: startDate, $lte: endDate }
      }),

      // Likes received in period
      db.collection('likes').aggregate([
        {
          $lookup: {
            from: 'posts',
            localField: 'post_id',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' },
        {
          $match: {
            'post.user_id': new ObjectId(userId),
            created_at: { $gte: startDate, $lte: endDate }
          }
        },
        { $count: 'total' }
      ]).toArray(),

      // Comments received in period
      db.collection('comments').aggregate([
        {
          $lookup: {
            from: 'posts',
            localField: 'post_id',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' },
        {
          $match: {
            'post.user_id': new ObjectId(userId),
            created_at: { $gte: startDate, $lte: endDate }
          }
        },
        { $count: 'total' }
      ]).toArray(),

      // Followers gained in period
      db.collection('follows').countDocuments({
        following_id: new ObjectId(userId),
        created_at: { $gte: startDate, $lte: endDate }
      }),

      // Profile views in period
      db.collection('profile_visits').countDocuments({
        profile_owner_id: new ObjectId(userId),
        visited_at: { $gte: startDate, $lte: endDate }
      }),

      // Stories created in period
      db.collection('stories').countDocuments({
        user_id: new ObjectId(userId),
        created_at: { $gte: startDate, $lte: endDate }
      }),

      // Reels created in period
      db.collection('reels').countDocuments({
        user_id: new ObjectId(userId),
        created_at: { $gte: startDate, $lte: endDate }
      })
    ]);

    return {
      period,
      startDate,
      endDate,
      posts: postsCount,
      likesReceived: likesReceived[0]?.total || 0,
      commentsReceived: commentsReceived[0]?.total || 0,
      followersGained,
      profileViews,
      storiesCreated,
      reelsCreated,
      engagement: this.calculateEngagement(
        postsCount,
        likesReceived[0]?.total || 0,
        commentsReceived[0]?.total || 0
      )
    };
  }

  // Platform analytics
  async getPlatformAnalytics(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const client = await this.getClient();
    const db = client.db();

    const startDate = this.getStartDate(period);
    const endDate = new Date();

    const [
      totalUsers,
      newUsers,
      totalPosts,
      newPosts,
      totalStories,
      totalReels,
      totalMessages,
      activeUsers
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('users').countDocuments({
        created_at: { $gte: startDate, $lte: endDate }
      }),
      db.collection('posts').countDocuments(),
      db.collection('posts').countDocuments({
        created_at: { $gte: startDate, $lte: endDate }
      }),
      db.collection('stories').countDocuments({
        created_at: { $gte: startDate, $lte: endDate }
      }),
      db.collection('reels').countDocuments({
        created_at: { $gte: startDate, $lte: endDate }
      }),
      db.collection('messages').countDocuments({
        created_at: { $gte: startDate, $lte: endDate }
      }),
      this.getActiveUsers(startDate, endDate)
    ]);

    return {
      period,
      startDate,
      endDate,
      totalUsers,
      newUsers,
      totalPosts,
      newPosts,
      totalStories,
      totalReels,
      totalMessages,
      activeUsers,
      growthRate: this.calculateGrowthRate(totalUsers, newUsers, period)
    };
  }

  // Content performance analytics
  async getContentPerformance(userId: string, contentType: 'posts' | 'stories' | 'reels') {
    const client = await this.getClient();
    const db = client.db();

    const collection = contentType === 'posts' ? 'posts' : 
                      contentType === 'stories' ? 'stories' : 'reels';

    const content = await db.collection(collection)
      .find({ user_id: new ObjectId(userId) })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    const performance = await Promise.all(
      content.map(async (item) => {
        const [likes, comments, views] = await Promise.all([
          db.collection(`${collection === 'posts' ? 'likes' : `reel_likes`}`)
            .countDocuments({ [`${collection === 'posts' ? 'post' : 'reel'}_id`]: item._id }),
          db.collection(`${collection === 'posts' ? 'comments' : `reel_comments`}`)
            .countDocuments({ [`${collection === 'posts' ? 'post' : 'reel'}_id`]: item._id }),
          collection === 'stories' ? 
            db.collection('stories').findOne({ _id: item._id }).then(s => s?.views_count || 0) :
            db.collection('reel_views').countDocuments({ reel_id: item._id })
        ]);

        return {
          id: item._id,
          caption: item.caption,
          created_at: item.created_at,
          likes,
          comments,
          views,
          engagement: this.calculateEngagement(1, likes, comments)
        };
      })
    );

    return performance.sort((a, b) => b.engagement - a.engagement);
  }

  // Trending content
  async getTrendingContent(type: 'posts' | 'reels', limit: number = 10) {
    const client = await this.getClient();
    const db = client.db();

    const collection = type === 'posts' ? 'posts' : 'reels';
    const likesCollection = type === 'posts' ? 'likes' : 'reel_likes';
    const commentsCollection = type === 'posts' ? 'comments' : 'reel_comments';

    const trending = await db.collection(collection)
      .aggregate([
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
            from: likesCollection,
            localField: '_id',
            foreignField: `${type === 'posts' ? 'post' : 'reel'}_id`,
            as: 'likes'
          }
        },
        {
          $lookup: {
            from: commentsCollection,
            localField: '_id',
            foreignField: `${type === 'posts' ? 'post' : 'reel'}_id`,
            as: 'comments'
          }
        },
        {
          $addFields: {
            engagement: {
              $add: [
                { $size: '$likes' },
                { $multiply: [{ $size: '$comments' }, 2] }
              ]
            }
          }
        },
        { $sort: { engagement: -1, created_at: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            caption: 1,
            media_urls: 1,
            media_type: 1,
            created_at: 1,
            likes_count: { $size: '$likes' },
            comments_count: { $size: '$comments' },
            engagement: 1,
            user: {
              username: 1,
              full_name: 1,
              avatar_url: 1,
              is_verified: 1
            }
          }
        }
      ])
      .toArray();

    return trending;
  }

  // Helper methods
  private getStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  private calculateEngagement(posts: number, likes: number, comments: number): number {
    if (posts === 0) return 0;
    return Math.round(((likes + comments * 2) / posts) * 100) / 100;
  }

  private calculateGrowthRate(total: number, newCount: number, period: string): number {
    if (total === 0) return 0;
    const rate = (newCount / total) * 100;
    return Math.round(rate * 100) / 100;
  }

  private async getActiveUsers(startDate: Date, endDate: Date): Promise<number> {
    const client = await this.getClient();
    const db = client.db();

    const activeUsers = await db.collection('users').aggregate([
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'user_id',
          as: 'posts'
        }
      },
      {
        $lookup: {
          from: 'stories',
          localField: '_id',
          foreignField: 'user_id',
          as: 'stories'
        }
      },
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'sender_id',
          as: 'messages'
        }
      },
      {
        $match: {
          $or: [
            { 'posts.created_at': { $gte: startDate, $lte: endDate } },
            { 'stories.created_at': { $gte: startDate, $lte: endDate } },
            { 'messages.created_at': { $gte: startDate, $lte: endDate } }
          ]
        }
      },
      { $count: 'total' }
    ]).toArray();

    return activeUsers[0]?.total || 0;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
export default analyticsService;
