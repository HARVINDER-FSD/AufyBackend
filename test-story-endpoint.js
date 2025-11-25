// Test script to verify story endpoints work
const mongoose = require('mongoose');
require('dotenv').config();

async function testStoryEndpoint() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import Story model
    const Story = require('./src/models/story').default;

    // Find the most recent story
    const recentStory = await Story.findOne({
      expires_at: { $gt: new Date() },
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .sort({ created_at: -1 })
      .lean();

    if (!recentStory) {
      console.log('❌ No active stories found in database');
      process.exit(0);
    }

    console.log('\n📖 Most Recent Story:');
    console.log('ID:', recentStory._id.toString());
    console.log('User:', recentStory.user_id?.username || 'Unknown');
    console.log('Media Type:', recentStory.media_type);
    console.log('Media URL:', recentStory.media_url);
    console.log('Created:', recentStory.created_at);
    console.log('Expires:', recentStory.expires_at);
    console.log('Views:', recentStory.views_count || 0);
    console.log('Has Music:', !!recentStory.music);
    console.log('Texts:', recentStory.texts?.length || 0);
    console.log('Stickers:', recentStory.stickers?.length || 0);

    console.log('\n✅ Story endpoint should work for ID:', recentStory._id.toString());
    console.log('Test URL: GET /api/stories/' + recentStory._id.toString());

    await mongoose.disconnect();
    console.log('\n✅ Test complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testStoryEndpoint();
