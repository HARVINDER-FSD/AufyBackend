import { Worker, Job } from 'bullmq';
import { getDatabase } from '../lib/database';
import { ObjectId } from 'mongodb';
import { logger } from '../middleware/logger';
import { QUEUE_NAMES } from '../lib/queue';

// Worker to process chat messages asynchronously
// Ensures "Makhan" (smooth) performance by offloading DB writes
export const setupChatWorker = (connection: any) => {
  if (!connection) return null;

  const worker = new Worker(QUEUE_NAMES.MESSAGES, async (job: Job) => {
    try {
      const {
        _id, // Pre-generated ID from socket server
        conversation_id,
        sender_id,
        content,
        message_type,
        media_url,
        reply_to_id,
        status,
        created_at
      } = job.data;

      const db = await getDatabase();
      const messagesCollection = db.collection('messages');
      const conversationsCollection = db.collection('conversations');

      // 1. Insert Message
      // Ensure IDs are ObjectIds
      const messageDoc = {
        _id: new ObjectId(_id),
        conversation_id: new ObjectId(conversation_id),
        sender_id: new ObjectId(sender_id),
        content,
        message_type,
        media_url,
        reply_to_id: reply_to_id ? new ObjectId(reply_to_id) : undefined,
        is_anonymous: job.data.is_anonymous || false,
        status: status || 'sent',
        created_at: new Date(created_at),
        updated_at: new Date(created_at),
        is_deleted: false,
        reactions: [],
        read_by: []
      };

      try {
        await messagesCollection.insertOne(messageDoc);
      } catch (err: any) {
        // If duplicate key error (rare, maybe retried), ignore
        if (err.code !== 11000) {
          throw err;
        }
      }

      // 2. Update Conversation (last_message and timestamp)
      // This makes the "inbox" sort order update immediately
      await conversationsCollection.updateOne(
        { _id: new ObjectId(conversation_id) },
        {
          $set: {
            last_message: messageDoc._id,
            updated_at: new Date(created_at)
          }
        }
      );

    } catch (error: any) {
      logger.error(`Failed to process chat job ${job.id}:`, error);
      throw error;
    }
  }, {
    connection,
    concurrency: 20 // High concurrency for chat messages
  });

  worker.on('failed', (job, err) => {
    logger.error(`Chat Job ${job?.id} failed:`, err);
  });

  return worker;
};
