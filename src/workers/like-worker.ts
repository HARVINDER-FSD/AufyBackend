import { Worker, Job } from 'bullmq';
import { getDatabase } from '../lib/database';
import { ObjectId } from 'mongodb';
import { logger } from '../middleware/logger';
import { QUEUE_NAMES, addJob } from '../lib/queue';

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
      const commentsCollection = db.collection('comments');
      const usersCollection = db.collection('users');

      // Map job type to DB content_type
      const contentTypeMap: Record<string, string> = {
        'post': 'Post',
        'reel': 'Reel',
        'comment': 'Comment'
      };
      const contentType = contentTypeMap[type] || 'Post';

      if (action === 'like') {
        // Optimistic Like: Try to insert directly
        try {
          await likesCollection.insertOne({
            user_id: new ObjectId(userId),
            post_id: new ObjectId(postId),
            created_at: new Date(),
            is_anonymous: is_anonymous || false,
            content_type: contentType // Use standard field name
          });
          
          // Increment likes count on post, reel, or comment
          let targetOwnerId: string | null = null;
          let realPostId = postId;
          
          if (type === 'reel') {
             await reelsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $inc: { likes_count: 1 } }
             );
             const reel = await reelsCollection.findOne({ _id: new ObjectId(postId) }, { projection: { user_id: 1 } });
             if (reel) targetOwnerId = reel.user_id.toString();
          } else if (type === 'comment') {
             await commentsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $inc: { likes_count: 1 } }
             );
             const comment = await commentsCollection.findOne({ _id: new ObjectId(postId) }, { projection: { user_id: 1, post_id: 1 } });
             if (comment) {
                 targetOwnerId = comment.user_id.toString();
                 realPostId = comment.post_id.toString();
             }
          } else {
             await postsCollection.updateOne(
                { _id: new ObjectId(postId) },
                { $inc: { likes_count: 1 } }
             );
             const post = await postsCollection.findOne({ _id: new ObjectId(postId) }, { projection: { user_id: 1 } });
             if (post) targetOwnerId = post.user_id.toString();
          }

          // Send Notification (if not own content)
          if (targetOwnerId && targetOwnerId !== userId) {
            const liker = await usersCollection.findOne({ _id: new ObjectId(userId) }, { projection: { username: 1 } });
            const likerName = is_anonymous ? "A Ghost User 👻" : (liker?.username || "Someone");
            
            await addJob(QUEUE_NAMES.NOTIFICATIONS, 'like-notification', {
              recipientId: targetOwnerId,
              title: 'New Like ❤️',
              body: `${likerName} liked your ${type}.`,
              data: {
                postId: realPostId, // Navigate to the actual post/reel
                commentId: type === 'comment' ? postId : undefined,
                type: 'like',
                contentType: type,
                actorId: userId
              }
            });
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
            } else if (type === 'comment') {
                await commentsCollection.updateOne(
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
