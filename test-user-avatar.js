// Test script to check user avatar in database
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkUserAvatar() {
  console.log('🔍 Checking user avatar in database...\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  
  // Find user by username
  const username = 'its_monu_0207';
  const user = await db.collection('users').findOne({ username });
  
  if (!user) {
    console.log('❌ User not found:', username);
    await client.close();
    return;
  }
  
  console.log('✅ User found:', username);
  console.log('📋 User ID:', user._id.toString());
  console.log('\n📸 Avatar fields:');
  console.log('  - avatar:', user.avatar || '(not set)');
  console.log('  - avatar_url:', user.avatar_url || '(not set)');
  console.log('  - profile_picture:', user.profile_picture || '(not set)');
  console.log('\n👤 Other fields:');
  console.log('  - name:', user.name || '(not set)');
  console.log('  - full_name:', user.full_name || '(not set)');
  console.log('  - bio:', user.bio || '(not set)');
  
  console.log('\n📦 All user fields:', Object.keys(user).join(', '));
  
  await client.close();
  process.exit(0);
}

checkUserAvatar().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
