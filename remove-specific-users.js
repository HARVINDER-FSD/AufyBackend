// Remove Specific Users by Pattern
// Usage: node remove-specific-users.js <pattern>
// Example: node remove-specific-users.js "testuser"

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const pattern = process.argv[2];

if (!pattern) {
  console.log('❌ Please provide a username pattern');
  console.log('Usage: node remove-specific-users.js <pattern>');
  console.log('Example: node remove-specific-users.js "testuser"');
  process.exit(1);
}

async function removeSpecificUsers() {
  console.log(`🗑️  Searching for users matching pattern: "${pattern}"\n`);

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Find users matching pattern
    const users = await db.collection('users').find({
      $or: [
        { username: new RegExp(pattern, 'i') },
        { email: new RegExp(pattern, 'i') }
      ]
    }).toArray();

    if (users.length === 0) {
      console.log('✅ No users found matching that pattern!');
      await client.close();
      return;
    }

    console.log(`📊 Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email}) - ID: ${user._id}`);
    });

    console.log('\n⚠️  WARNING: This will permanently delete these users and ALL their data!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Removing users and their data...\n');

    const userIds = users.map(u => u._id);

    // Delete all related data
    const results = {
      users: await db.collection('users').deleteMany({ _id: { $in: userIds } }),
      posts: await db.collection('posts').deleteMany({ user_id: { $in: userIds } }),
      stories: await db.collection('stories').deleteMany({ user_id: { $in: userIds } }),
      reels: await db.collection('reels').deleteMany({ user_id: { $in: userIds } }),
      comments: await db.collection('comments').deleteMany({ user_id: { $in: userIds } }),
      likes: await db.collection('likes').deleteMany({ user_id: { $in: userIds } }),
      follows1: await db.collection('follows').deleteMany({ followerId: { $in: userIds } }),
      follows2: await db.collection('follows').deleteMany({ followingId: { $in: userIds } }),
      followRequests1: await db.collection('followRequests').deleteMany({ requester_id: { $in: userIds } }),
      followRequests2: await db.collection('followRequests').deleteMany({ requested_id: { $in: userIds } }),
      notifications1: await db.collection('notifications').deleteMany({ user_id: { $in: userIds } }),
      notifications2: await db.collection('notifications').deleteMany({ from_user_id: { $in: userIds } }),
      messages: await db.collection('messages').deleteMany({ $or: [{ sender_id: { $in: userIds } }, { receiver_id: { $in: userIds } }] }),
      conversations: await db.collection('conversations').deleteMany({ participants: { $in: userIds } }),
      bookmarks: await db.collection('bookmarks').deleteMany({ user_id: { $in: userIds } }),
      crushes1: await db.collection('secretCrushes').deleteMany({ user_id: { $in: userIds } }),
      crushes2: await db.collection('secretCrushes').deleteMany({ crush_user_id: { $in: userIds } }),
      reports: await db.collection('reports').deleteMany({ $or: [{ reporter_id: { $in: userIds } }, { reported_user_id: { $in: userIds } }] }),
    };

    console.log('✅ Deletion complete!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${results.users.deletedCount}`);
    console.log(`   Posts: ${results.posts.deletedCount}`);
    console.log(`   Stories: ${results.stories.deletedCount}`);
    console.log(`   Reels: ${results.reels.deletedCount}`);
    console.log(`   Comments: ${results.comments.deletedCount}`);
    console.log(`   Likes: ${results.likes.deletedCount}`);
    console.log(`   Follows: ${results.follows1.deletedCount + results.follows2.deletedCount}`);
    console.log(`   Follow Requests: ${results.followRequests1.deletedCount + results.followRequests2.deletedCount}`);
    console.log(`   Notifications: ${results.notifications1.deletedCount + results.notifications2.deletedCount}`);
    console.log(`   Messages: ${results.messages.deletedCount}`);
    console.log(`   Conversations: ${results.conversations.deletedCount}`);
    console.log(`   Bookmarks: ${results.bookmarks.deletedCount}`);
    console.log(`   Secret Crushes: ${results.crushes1.deletedCount + results.crushes2.deletedCount}`);
    console.log(`   Reports: ${results.reports.deletedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

removeSpecificUsers().catch(console.error);
