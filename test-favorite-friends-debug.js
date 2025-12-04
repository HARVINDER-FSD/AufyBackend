// Test script to debug favorite friends (secret crush) feature
const mongoose = require('mongoose');
require('dotenv').config();

async function testFavoriteFriends() {
  try {
    console.log('🔍 FAVORITE FRIENDS DEBUG TEST\n');
    console.log('================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const SecretCrush = mongoose.model('SecretCrush', new mongoose.Schema({}, { strict: false }));

    // Get all users
    const users = await User.find({}).select('_id username email isPremium secretCrushCount').lean();
    console.log(`📊 Total users in database: ${users.length}\n`);

    if (users.length === 0) {
      console.log('❌ No users found in database!');
      return;
    }

    // Display all users
    console.log('👥 Users:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.email})`);
      console.log(`      ID: ${user._id}`);
      console.log(`      Premium: ${user.isPremium || false}`);
      console.log(`      Crush Count: ${user.secretCrushCount || 0}`);
    });
    console.log('');

    // Get all secret crushes
    const crushes = await SecretCrush.find({}).lean();
    console.log(`💕 Total secret crushes: ${crushes.length}\n`);

    if (crushes.length > 0) {
      console.log('📋 Secret Crush List:');
      for (const crush of crushes) {
        const fromUser = users.find(u => u._id.toString() === crush.userId.toString());
        const toUser = users.find(u => u._id.toString() === crush.crushUserId.toString());
        
        console.log(`   ${fromUser?.username || 'Unknown'} → ${toUser?.username || 'Unknown'}`);
        console.log(`      Mutual: ${crush.isMutual || false}`);
        console.log(`      Active: ${crush.isActive !== false}`);
        console.log(`      Created: ${crush.createdAt}`);
      }
      console.log('');
    }

    // Test adding a favorite friend
    if (users.length >= 2) {
      const user1 = users[0];
      const user2 = users[1];

      console.log(`\n🧪 TEST: Adding ${user2.username} to ${user1.username}'s favorites\n`);

      // Check if already exists
      const existing = await SecretCrush.findOne({
        userId: user1._id,
        crushUserId: user2._id,
        isActive: true
      });

      if (existing) {
        console.log('⚠️  Already exists in favorites list');
        console.log(`   Mutual: ${existing.isMutual}`);
        console.log(`   Chat ID: ${existing.mutualChatId || 'None'}`);
      } else {
        // Check limit
        const currentCount = await SecretCrush.countDocuments({
          userId: user1._id,
          isActive: true
        });
        const maxCrushes = user1.isPremium ? 10 : 5;

        console.log(`📊 Current favorites: ${currentCount}/${maxCrushes}`);

        if (currentCount >= maxCrushes) {
          console.log(`❌ LIMIT REACHED! User has ${currentCount} favorites (max: ${maxCrushes})`);
          console.log(`   Solution: ${user1.isPremium ? 'Remove some favorites' : 'Upgrade to premium or remove some favorites'}`);
        } else {
          console.log('✅ Can add to favorites (under limit)');

          // Check if mutual
          const mutualCrush = await SecretCrush.findOne({
            userId: user2._id,
            crushUserId: user1._id,
            isActive: true
          });

          if (mutualCrush) {
            console.log(`💕 MUTUAL MATCH! ${user2.username} also added ${user1.username}`);
          } else {
            console.log(`   ${user2.username} has not added ${user1.username} yet`);
          }

          // Simulate the add
          console.log('\n✅ ADD WOULD SUCCEED');
        }
      }
    }

    // Check for any issues
    console.log('\n\n🔍 CHECKING FOR ISSUES:\n');

    // Check for users with incorrect crush counts
    for (const user of users) {
      const actualCount = await SecretCrush.countDocuments({
        userId: user._id,
        isActive: true
      });
      const storedCount = user.secretCrushCount || 0;

      if (actualCount !== storedCount) {
        console.log(`⚠️  ${user.username}: Count mismatch!`);
        console.log(`   Stored: ${storedCount}, Actual: ${actualCount}`);
        console.log(`   Fix: Update user.secretCrushCount to ${actualCount}`);
      }
    }

    // Check for inactive crushes
    const inactiveCrushes = await SecretCrush.countDocuments({ isActive: false });
    if (inactiveCrushes > 0) {
      console.log(`\n📊 ${inactiveCrushes} inactive crushes in database (removed favorites)`);
    }

    // Check for orphaned crushes (user doesn't exist)
    const allCrushes = await SecretCrush.find({}).lean();
    const userIds = new Set(users.map(u => u._id.toString()));
    
    let orphanedCount = 0;
    for (const crush of allCrushes) {
      if (!userIds.has(crush.userId.toString()) || !userIds.has(crush.crushUserId.toString())) {
        orphanedCount++;
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`⚠️  ${orphanedCount} orphaned crushes (user deleted)`);
    }

    console.log('\n✅ Diagnostic complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

testFavoriteFriends();
