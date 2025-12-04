// Detailed test to see exact error when adding favorite
const mongoose = require('mongoose');
require('dotenv').config();

async function testAddFavoriteDetailed() {
  try {
    console.log('🔍 DETAILED FAVORITE FRIEND ADD TEST\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const SecretCrush = mongoose.model('SecretCrush', new mongoose.Schema({}, { strict: false }));

    const currentUserId = '68fa0a99696d2b1cf4f5143d'; // Its.harvinder.05
    const crushUserId = '693027231dc71aa588c1023e'; // krinaprajapati24

    console.log('Testing add operation...\n');
    console.log(`Current User: ${currentUserId}`);
    console.log(`Target User: ${crushUserId}\n`);

    // Step 1: Validate crush user exists
    console.log('1️⃣  Checking if target user exists...');
    const crushUser = await User.findOne({ _id: crushUserId });
    if (!crushUser) {
      console.log('❌ Target user not found!');
      return;
    }
    console.log(`✅ Target user found: ${crushUser.username}\n`);

    // Step 2: Get current user
    console.log('2️⃣  Checking current user...');
    const currentUser = await User.findOne({ _id: currentUserId });
    if (!currentUser) {
      console.log('❌ Current user not found!');
      return;
    }
    console.log(`✅ Current user found: ${currentUser.username}`);
    console.log(`   Premium: ${currentUser.isPremium || false}\n`);

    // Step 3: Check if already exists
    console.log('3️⃣  Checking if already in favorites...');
    const existing = await SecretCrush.findOne({
      userId: currentUserId,
      crushUserId,
      isActive: true
    });
    if (existing) {
      console.log('⚠️  Already exists!');
      console.log(`   Mutual: ${existing.isMutual}`);
      return;
    }
    console.log('✅ Not in favorites yet\n');

    // Step 4: Check limit
    console.log('4️⃣  Checking favorites limit...');
    const maxCrushes = currentUser.isPremium ? 10 : 5;
    const currentCount = await SecretCrush.countDocuments({
      userId: currentUserId,
      isActive: true
    });
    console.log(`   Current: ${currentCount}/${maxCrushes}`);
    if (currentCount >= maxCrushes) {
      console.log('❌ LIMIT REACHED!');
      return;
    }
    console.log('✅ Under limit\n');

    // Step 5: Try to create the entry
    console.log('5️⃣  Creating secret crush entry...');
    try {
      const secretCrush = new SecretCrush({
        userId: new mongoose.Types.ObjectId(currentUserId),
        crushUserId: new mongoose.Types.ObjectId(crushUserId),
        isActive: true,
        isMutual: false,
        createdAt: new Date()
      });

      await secretCrush.save();
      console.log('✅ Secret crush entry created successfully!');
      console.log(`   ID: ${secretCrush._id}\n`);

      // Step 6: Update user count
      console.log('6️⃣  Updating user crush count...');
      await User.updateOne(
        { _id: currentUserId },
        { $inc: { secretCrushCount: 1 } }
      );
      console.log('✅ User count updated\n');

      // Verify
      const updated = await User.findOne({ _id: currentUserId });
      console.log(`✅ Final crush count: ${updated.secretCrushCount || 0}\n`);

      console.log('🎉 ADD SUCCESSFUL!\n');

    } catch (saveError) {
      console.log('❌ ERROR SAVING:');
      console.log('   Error:', saveError.message);
      console.log('   Code:', saveError.code);
      console.log('   Full error:', saveError);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testAddFavoriteDetailed();
