// List All Users in Database
// Shows username, email, and creation date

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function listAllUsers() {
  console.log('📋 Fetching all users from database...\n');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    const users = await db.collection('users')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`📊 Total users: ${users.length}\n`);

    if (users.length === 0) {
      console.log('No users found in database.');
      await client.close();
      return;
    }

    // Categorize users
    const testUsers = [];
    const realUsers = [];

    users.forEach(user => {
      const username = user.username || '';
      const email = user.email || '';
      
      if (
        username.toLowerCase().includes('test') ||
        email.toLowerCase().includes('test') ||
        username.toLowerCase().includes('demo') ||
        email.toLowerCase().includes('demo') ||
        username.toLowerCase().includes('sample') ||
        email.toLowerCase().includes('sample')
      ) {
        testUsers.push(user);
      } else {
        realUsers.push(user);
      }
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST/DEMO USERS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (testUsers.length === 0) {
      console.log('✅ No test users found!\n');
    } else {
      testUsers.forEach((user, index) => {
        const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
        console.log(`${index + 1}. ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Created: ${createdAt}`);
        console.log(`   Followers: ${user.followers_count || 0} | Following: ${user.following_count || 0}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('👤 REAL USERS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (realUsers.length === 0) {
      console.log('No real users found.\n');
    } else {
      realUsers.forEach((user, index) => {
        const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
        console.log(`${index + 1}. ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Created: ${createdAt}`);
        console.log(`   Followers: ${user.followers_count || 0} | Following: ${user.following_count || 0}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Users: ${users.length}`);
    console.log(`Test Users: ${testUsers.length}`);
    console.log(`Real Users: ${realUsers.length}`);
    console.log('');

    if (testUsers.length > 0) {
      console.log('💡 To remove test users, run:');
      console.log('   node remove-test-users.js');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

listAllUsers().catch(console.error);
