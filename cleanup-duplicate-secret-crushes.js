// Cleanup duplicate secret crush entries
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media';

async function cleanupDuplicateSecretCrushes() {
  console.log('🧹 Cleaning up duplicate secret crush entries...\n');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Find all duplicates
    const duplicates = await db.collection('secretcrushes').aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            crushUserId: '$crushUserId'
          },
          entries: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    console.log(`Found ${duplicates.length} duplicate pairs\n`);

    let totalDeleted = 0;

    for (const duplicate of duplicates) {
      const entries = duplicate.entries;
      
      console.log(`\n📋 Duplicate found:`);
      console.log(`   User: ${duplicate._id.userId}`);
      console.log(`   Crush: ${duplicate._id.crushUserId}`);
      console.log(`   Count: ${entries.length} entries`);

      // Sort by creation date (keep the oldest one)
      entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Keep the first one, delete the rest
      const toKeep = entries[0];
      const toDelete = entries.slice(1);

      console.log(`   Keeping: ${toKeep._id} (created: ${toKeep.createdAt})`);
      console.log(`   Deleting: ${toDelete.length} duplicate(s)`);

      // Delete duplicates
      const deleteIds = toDelete.map(e => e._id);
      const result = await db.collection('secretcrushes').deleteMany({
        _id: { $in: deleteIds }
      });

      totalDeleted += result.deletedCount;
      console.log(`   ✅ Deleted ${result.deletedCount} duplicate(s)`);
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Total duplicates removed: ${totalDeleted}`);

    // Show final count
    const finalCount = await db.collection('secretcrushes').countDocuments();
    console.log(`   Remaining secret crushes: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
  }
}

cleanupDuplicateSecretCrushes();
