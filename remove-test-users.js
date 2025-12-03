// Remove All Test Users and Test Accounts
// This script will delete all users with "test" in their username or email

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function removeTestUsers() {
  console.log('🗑️  Starting test user removal...\n');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Find all test users
    const testUserPatterns = [
      { username: /test/i },
      { email: /test/i },
      { username: /demo/i },
      { email: /demo/i },
      { username: /sample/i },
      { email: /sample/i },
    ];

    const testUsers = await db.collection('users').find({
      $or: testUserPatterns
    }).toArray();

    console.log(`📊 Found ${testUsers.length} test users:\n`);
    
    testUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email})`);
    });

    if (testUsers.length === 0) {
      console.log('\n✅ No test users found!');
      await client.close();
      return;
    }

    console.log('\n🗑️  Removing test users and their data...\n');

    const testUserIds = testUsers.map(u => u._id);

    // 1. Delete test users
    const usersResult = await db.collection('users').deleteMany({
      _id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${usersResult.deletedCount} test users`);

    // 2. Delete their posts
    const postsResult = await db.collection('posts').deleteMany({
      user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${postsResult.deletedCount} posts`);

    // 3. Delete their stories
    const storiesResult = await db.collection('stories').deleteMany({
      user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${storiesResult.deletedCount} stories`);

    // 4. Delete their reels
    const reelsResult = await db.collection('reels').deleteMany({
      user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${reelsResult.deletedCount} reels`);

    // 5. Delete their comments
    const commentsResult = await db.collection('comments').deleteMany({
      user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${commentsResult.deletedCount} comments`);

    // 6. Delete their likes
    const likesResult = await db.collection('likes').deleteMany({
      user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${likesResult.deletedCount} likes`);

    // 7. Delete their follows (as follower)
    const followsResult1 = await db.collection('follows').deleteMany({
      followerId: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${followsResult1.deletedCount} follows (as follower)`);

    // 8. Delete their follows (as following)
    const followsResult2 = await db.collection('follows').deleteMany({
      followingId: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${followsResult2.deletedCount} follows (as following)`);

    // 9. Delete their follow requests
    const followRequestsResult1 = await db.collection('followRequests').deleteMany({
      requester_id: { $in: testUserIds }
    });
    const followRequestsResult2 = await db.collection('followRequests').deleteMany({
      requested_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${followRequestsResult1.deletedCount + followRequestsResult2.deletedCount} follow requests`);

    // 10. Delete their notifications
    const notificationsResult1 = await db.collection('notifications').deleteMany({
      user_id: { $in: testUserIds }
    });
    const notificationsResult2 = await db.collection('notifications').deleteMany({
      from_user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${notificationsResult1.deletedCount + notificationsResult2.deletedCount} notifications`);

    // 11. Delete their messages
    const messagesResult = await db.collection('messages').deleteMany({
      $or: [
        { sender_id: { $in: testUserIds } },
        { receiver_id: { $in: testUserIds } }
      ]
    });
    console.log(`✅ Deleted ${messagesResult.deletedCount} messages`);

    // 12. Delete their conversations
    const conversationsResult = await db.collection('conversations').deleteMany({
      participants: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${conversationsResult.deletedCount} conversations`);

    // 13. Delete their bookmarks
    const bookmarksResult = await db.collection('bookmarks').deleteMany({
      user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${bookmarksResult.deletedCount} bookmarks`);

    // 14. Delete their secret crush data
    const crushResult1 = await db.collection('secretCrushes').deleteMany({
      user_id: { $in: testUserIds }
    });
    const crushResult2 = await db.collection('secretCrushes').deleteMany({
      crush_user_id: { $in: testUserIds }
    });
    console.log(`✅ Deleted ${crushResult1.deletedCount + crushResult2.deletedCount} secret crush entries`);

    // 15. Delete their reports
    const reportsResult = await db.collection('reports').deleteMany({
      $or: [
        { reporter_id: { $in: testUserIds } },
        { reported_user_id: { $in: testUserIds } }
      ]
    });
    console.log(`✅ Deleted ${reportsResult.deletedCount} reports`);

    console.log('\n✅ All test users and their data have been removed!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${usersResult.deletedCount}`);
    console.log(`   Posts: ${postsResult.deletedCount}`);
    console.log(`   Stories: ${storiesResult.deletedCount}`);
    console.log(`   Reels: ${reelsResult.deletedCount}`);
    console.log(`   Comments: ${commentsResult.deletedCount}`);
    console.log(`   Likes: ${likesResult.deletedCount}`);
    console.log(`   Follows: ${followsResult1.deletedCount + followsResult2.deletedCount}`);
    console.log(`   Follow Requests: ${followRequestsResult1.deletedCount + followRequestsResult2.deletedCount}`);
    console.log(`   Notifications: ${notificationsResult1.deletedCount + notificationsResult2.deletedCount}`);
    console.log(`   Messages: ${messagesResult.deletedCount}`);
    console.log(`   Conversations: ${conversationsResult.deletedCount}`);
    console.log(`   Bookmarks: ${bookmarksResult.deletedCount}`);
    console.log(`   Secret Crushes: ${crushResult1.deletedCount + crushResult2.deletedCount}`);
    console.log(`   Reports: ${reportsResult.deletedCount}`);

  } catch (error) {
    console.error('❌ Error removing test users:', error);
  } finally {
    await client.close();
  }
}

// Run the script
removeTestUsers().catch(console.error);
