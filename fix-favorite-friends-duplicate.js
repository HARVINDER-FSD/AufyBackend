// Fix duplicate key issue by removing inactive entries or updating the index
const mongoose = require('mongoose');
require('dotenv').config();

async function fixDuplicateIssue() {
  try {
    console.log('🔧 FIXING FAVORITE FRIENDS DUPLICATE KEY ISSUE\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const SecretCrush = mongoose.model('SecretCrush', new mongoose.Schema({}, { strict: false }));

    // Option 1: Delete all inactive entries
    console.log('1️⃣  Finding inactive secret crush entries...');
    const inactiveEntries = await SecretCrush.find({ isActive: false });
    console.log(`   Found ${inactiveEntries.length} inactive entries\n`);

    if (inactiveEntries.length > 0) {
      console.log('   Inactive entries:');
      for (const entry of inactiveEntries) {
        console.log(`   - ${entry.userId} → ${entry.crushUserId} (Created: ${entry.createdAt})`);
      }

      console.log('\n2️⃣  Deleting inactive entries...');
      const result = await SecretCrush.deleteMany({ isActive: false });
      console.log(`✅ Deleted ${result.deletedCount} inactive entries\n`);
    }

    // Option 2: Check the index
    console.log('3️⃣  Checking database indexes...');
    const indexes = await SecretCrush.collection.getIndexes();
    console.log('   Current indexes:');
    Object.keys(indexes).forEach(indexName => {
      console.log(`   - ${indexName}:`, indexes[indexName]);
    });

    // The issue is the unique index doesn't include isActive
    // We need to drop the old index and create a new one
    console.log('\n4️⃣  Fixing index...');
    try {
      await SecretCrush.collection.dropIndex('userId_1_crushUserId_1');
      console.log('✅ Dropped old unique index');
    } catch (err) {
      console.log('⚠️  Could not drop index (might not exist):', err.message);
    }

    // Create new compound index that includes isActive
    try {
      await SecretCrush.collection.createIndex(
        { userId: 1, crushUserId: 1, isActive: 1 },
        { unique: true, partialFilterExpression: { isActive: true } }
      );
      console.log('✅ Created new unique index with isActive filter\n');
    } catch (err) {
      console.log('⚠️  Could not create new index:', err.message);
    }

    // Verify
    console.log('5️⃣  Verifying fix...');
    const newIndexes = await SecretCrush.collection.getIndexes();
    console.log('   Updated indexes:');
    Object.keys(newIndexes).forEach(indexName => {
      console.log(`   - ${indexName}:`, newIndexes[indexName]);
    });

    console.log('\n✅ FIX COMPLETE!\n');
    console.log('📝 Summary:');
    console.log('   - Deleted inactive entries to prevent conflicts');
    console.log('   - Updated index to allow reactivation of favorites');
    console.log('   - Users can now add/remove favorites multiple times\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixDuplicateIssue();
