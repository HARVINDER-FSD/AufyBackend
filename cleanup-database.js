// Database Cleanup Tool - Interactive Menu
// Safely remove test users and clean up database

const { MongoClient } = require('mongodb');
const readline = require('readline');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listUsers(db) {
  const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();
  
  const testUsers = users.filter(u => 
    (u.username || '').toLowerCase().match(/test|demo|sample/) ||
    (u.email || '').toLowerCase().match(/test|demo|sample/)
  );
  
  const realUsers = users.filter(u => !testUsers.includes(u));
  
  console.log('\n📊 DATABASE USERS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total: ${users.length} | Test: ${testUsers.length} | Real: ${realUsers.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (testUsers.length > 0) {
    console.log('🧪 TEST USERS:');
    testUsers.forEach((u, i) => {
      console.log(`${i + 1}. ${u.username} (${u.email})`);
    });
    console.log('');
  }
  
  if (realUsers.length > 0) {
    console.log('👤 REAL USERS:');
    realUsers.forEach((u, i) => {
      console.log(`${i + 1}. ${u.username} (${u.email})`);
    });
    console.log('');
  }
  
  return { testUsers, realUsers, allUsers: users };
}

async function removeTestUsers(db, testUsers) {
  if (testUsers.length === 0) {
    console.log('\n✅ No test users to remove!');
    return;
  }
  
  console.log(`\n⚠️  About to delete ${testUsers.length} test users and ALL their data!`);
  const confirm = await question('Type "DELETE" to confirm: ');
  
  if (confirm !== 'DELETE') {
    console.log('❌ Cancelled.');
    return;
  }
  
  console.log('\n🗑️  Removing test users...\n');
  
  const userIds = testUsers.map(u => u._id);
  
  const results = {
    users: await db.collection('users').deleteMany({ _id: { $in: userIds } }),
    posts: await db.collection('posts').deleteMany({ user_id: { $in: userIds } }),
    stories: await db.collection('stories').deleteMany({ user_id: { $in: userIds } }),
    reels: await db.collection('reels').deleteMany({ user_id: { $in: userIds } }),
    comments: await db.collection('comments').deleteMany({ user_id: { $in: userIds } }),
    likes: await db.collection('likes').deleteMany({ user_id: { $in: userIds } }),
    follows: await db.collection('follows').deleteMany({ 
      $or: [{ followerId: { $in: userIds } }, { followingId: { $in: userIds } }]
    }),
    followRequests: await db.collection('followRequests').deleteMany({
      $or: [{ requester_id: { $in: userIds } }, { requested_id: { $in: userIds } }]
    }),
    notifications: await db.collection('notifications').deleteMany({
      $or: [{ user_id: { $in: userIds } }, { from_user_id: { $in: userIds } }]
    }),
    messages: await db.collection('messages').deleteMany({
      $or: [{ sender_id: { $in: userIds } }, { receiver_id: { $in: userIds } }]
    }),
    conversations: await db.collection('conversations').deleteMany({ participants: { $in: userIds } }),
    bookmarks: await db.collection('bookmarks').deleteMany({ user_id: { $in: userIds } }),
    crushes: await db.collection('secretCrushes').deleteMany({
      $or: [{ user_id: { $in: userIds } }, { crush_user_id: { $in: userIds } }]
    }),
    reports: await db.collection('reports').deleteMany({
      $or: [{ reporter_id: { $in: userIds } }, { reported_user_id: { $in: userIds } }]
    }),
  };
  
  console.log('✅ Deletion complete!\n');
  console.log('📊 Deleted:');
  Object.entries(results).forEach(([key, result]) => {
    if (result.deletedCount > 0) {
      console.log(`   ${key}: ${result.deletedCount}`);
    }
  });
}

async function removeAllData(db) {
  console.log('\n⚠️  WARNING: This will delete ALL data from ALL collections!');
  console.log('This action cannot be undone!');
  const confirm = await question('Type "DELETE ALL DATA" to confirm: ');
  
  if (confirm !== 'DELETE ALL DATA') {
    console.log('❌ Cancelled.');
    return;
  }
  
  console.log('\n🗑️  Removing all data...\n');
  
  const collections = [
    'users', 'posts', 'stories', 'reels', 'comments', 'likes',
    'follows', 'followRequests', 'notifications', 'messages',
    'conversations', 'bookmarks', 'secretCrushes', 'reports'
  ];
  
  for (const collection of collections) {
    const result = await db.collection(collection).deleteMany({});
    console.log(`✅ ${collection}: ${result.deletedCount} deleted`);
  }
  
  console.log('\n✅ All data removed!');
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         DATABASE CLEANUP TOOL                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  
  try {
    while (true) {
      console.log('\n📋 MENU:');
      console.log('1. List all users');
      console.log('2. Remove test users (test/demo/sample)');
      console.log('3. Remove specific user by username');
      console.log('4. Remove ALL data (DANGEROUS!)');
      console.log('5. Exit');
      
      const choice = await question('\nSelect option (1-5): ');
      
      switch (choice) {
        case '1':
          await listUsers(db);
          break;
          
        case '2':
          const { testUsers } = await listUsers(db);
          await removeTestUsers(db, testUsers);
          break;
          
        case '3':
          const username = await question('Enter username to remove: ');
          const user = await db.collection('users').findOne({ username });
          if (!user) {
            console.log('❌ User not found!');
          } else {
            console.log(`\nFound: ${user.username} (${user.email})`);
            const confirm = await question('Type "DELETE" to confirm: ');
            if (confirm === 'DELETE') {
              await removeTestUsers(db, [user]);
            } else {
              console.log('❌ Cancelled.');
            }
          }
          break;
          
        case '4':
          await removeAllData(db);
          break;
          
        case '5':
          console.log('\n👋 Goodbye!');
          rl.close();
          await client.close();
          process.exit(0);
          
        default:
          console.log('❌ Invalid option!');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
    await client.close();
  }
}

main().catch(console.error);
