
import { getDatabase } from "../lib/database";
import { logger } from "../middleware/logger";

export async function createIndexes() {
  const db = await getDatabase();
  const users = db.collection('users');
  const posts = db.collection('posts');
  const likes = db.collection('likes');
  const comments = db.collection('comments');
  const follows = db.collection('follows');

  logger.info("🚀 Creating Database Indexes for Million-User Scale...");

  // Users Indexes
  await users.createIndex({ username: 1 }, { unique: true });
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ is_verified: 1 });
  await users.createIndex({ isAnonymousMode: 1 }); // For anonymous checks

  // Posts Indexes
  // 1. Core Feed Index: Get posts by user, sorted by creation
  await posts.createIndex({ user_id: 1, created_at: -1, is_archived: 1 });
  
  // 2. Main Feed Sorting: Engagement score (likes + comments)
  // Note: MongoDB cannot index computed fields directly without Views, 
  // but we can index the source fields to help sort/filter.
  await posts.createIndex({ likes_count: -1, created_at: -1 });
  
  // 3. Filtering
  await posts.createIndex({ is_archived: 1 });

  // Likes Indexes
  // 1. Check if user liked post (Unique constraint prevents duplicates)
  await likes.createIndex({ user_id: 1, post_id: 1 }, { unique: true });
  // 2. Get all likes for a post
  await likes.createIndex({ post_id: 1, created_at: -1 });

  // Comments Indexes
  // 1. Get comments for a post
  await comments.createIndex({ post_id: 1, created_at: -1 });

  // Follows Indexes
  // 1. Get followers
  await follows.createIndex({ following_id: 1, status: 1 });
  // 2. Get following
  await follows.createIndex({ follower_id: 1, status: 1 });
  // 3. Unique Relationship
  await follows.createIndex({ follower_id: 1, following_id: 1 }, { unique: true });

  logger.info("✅ All Indexes Created Successfully!");
}

// Run if called directly
if (require.main === module) {
    createIndexes().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
