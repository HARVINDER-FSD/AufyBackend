// Cleanup Duplicate Notifications Script
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function cleanupDuplicateNotifications() {
  console.log('🧹 Starting duplicate notification cleanup...\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Find duplicate notifications (same userId, actorId, type, and target within 24 hours)
    const duplicates = await db.collection('notifications').aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            actorId: '$actorId',
            type: '$type',
            postId: '$postId',
            commentId: '$commentId',
            conversationId: '$conversationId'
          },
          notifications: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    console.log(`Found ${duplicates.length} groups of duplicate notifications\n`);

    let deletedCount = 0;

    // For each group of duplicates, keep the most recent one and delete others
    for (const group of duplicates) {
      const notifications = group.notifications.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      console.log(`Group: ${group._id.type} from actor ${group._id.actorId} to user ${group._id.userId}`);
      console.log(`  - Found ${notifications.length} duplicates`);
      console.log(`  - Keeping most recent: ${notifications[0].createdAt}`);
      
      // Keep the first (most recent), delete the rest
      const toDelete = notifications.slice(1).map(n => n._id);
      
      if (toDelete.length > 0) {
        const result = await db.collection('notifications').deleteMany({
          _id: { $in: toDelete }
        });
        deletedCount += result.deletedCount || 0;
        console.log(`  - Deleted ${result.deletedCount} old duplicates\n`);
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`📊 Total duplicates removed: ${deletedCount}`);
    
    // Show remaining notification count
    const totalNotifications = await db.collection('notifications').countDocuments();
    console.log(`📬 Remaining notifications: ${totalNotifications}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
  }
}

// Run the cleanup
cleanupDuplicateNotifications()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
