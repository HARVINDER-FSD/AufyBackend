const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas directly since models are in TypeScript
const userSchema = new mongoose.Schema({}, { strict: false });
const postSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

async function fixHardcodedPostCounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`\n📊 Found ${users.length} users\n`);

    for (const user of users) {
      // Count actual posts from database
      const actualPostCount = await Post.countDocuments({ user: user._id });
      
      // Get current stored count
      const storedCount = user.posts_count || 0;
      
      console.log(`User: ${user.username}`);
      console.log(`  Stored count: ${storedCount}`);
      console.log(`  Actual count: ${actualPostCount}`);
      
      if (storedCount !== actualPostCount) {
        console.log(`  ⚠️  MISMATCH! Fixing...`);
        
        // Update with actual count
        await User.findByIdAndUpdate(user._id, {
          posts_count: actualPostCount
        });
        
        console.log(`  ✅ Fixed: ${storedCount} → ${actualPostCount}`);
      } else {
        console.log(`  ✓ Already correct`);
      }
      console.log('');
    }

    console.log('\n✅ All post counts fixed!\n');
    
    // Show final summary
    console.log('📋 FINAL SUMMARY:');
    const updatedUsers = await User.find({}).select('username posts_count');
    for (const user of updatedUsers) {
      const actualCount = await Post.countDocuments({ user: user._id });
      console.log(`  ${user.username}: ${user.posts_count || 0} posts (verified: ${actualCount})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixHardcodedPostCounts();
