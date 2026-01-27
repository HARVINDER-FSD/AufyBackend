import { Worker, Job } from 'bullmq';
import { getDatabase } from '../lib/database';
import { ObjectId } from 'mongodb';
import { logger } from '../middleware/logger';
import { QUEUE_NAMES } from '../lib/queue';

// Worker to process likes asynchronously
// This allows the API to respond immediately while DB updates happen in background
export const setupLikeWorker = (connection: any) => {
  if (!connection) return null;

  const worker = new Worker(QUEUE_NAMES.LIKES, async (job: Job) => {
    try {
      const { userId, postId, action, is_anonymous, type = 'post' } = job.data;
      const db = await getDatabase();
      const likesCollection = db.collection('likes');
      const postsCollection = db.collection('posts');
      const reelsCollection = db.collection('reels');

      if (action === 'like') {
        // Optimistic Like: Try to insert directly
        try {
          await likesCollection.insertOne({
            user_id: new ObjectId(userId),
            post_id: new ObjectId(postId),
            created_at: new Date(),
            is_anonymous: is_anonymous || false,
            type: type // store type for future reference if needed
          });
          
          // Increment likes count on post or reel
          if (type === 'reel') {
             await reelsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $inc: { likes_count: 1 } }
             );
          } else {
             await postsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $inc: { likes_count: 1 } }
             );
          }
        } catch (error: any) {
          if (error.code === 11000) {
            // Duplicate key error - user already liked, ignore
            return;
          }
          throw error;
        }
      } else if (action === 'unlike') {
        const result = await likesCollection.deleteOne({
          user_id: new ObjectId(userId),
          post_id: new ObjectId(postId)
        });

        if (result.deletedCount > 0) {
            // Decrement likes count
            if (type === 'reel') {
                await reelsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { $inc: { likes_count: -1 } }
                );
            } else {
                await postsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { $inc: { likes_count: -1 } }
                );
            }
        }
      }
    } catch (error: any) {
      logger.error(`Failed to process like job ${job.id}:`, error);
      throw error;
    }
  }, {
    connection,
    concurrency: 5 // Process 5 likes in parallel
  });

  worker.on('completed', (job) => {
    logger.debug(`Like job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Like job ${job?.id} failed:`, err);
  });

  return worker;
};
