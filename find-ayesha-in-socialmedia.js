const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function findAyeshaInSocialMedia() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Searching for Ayesha in socialmedia database');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Get all users to find Ayesha
    console.log('\n📋 Getting all users from socialmedia database...');
    const allUsers = await usersCollection.find({}).toArray();
    
    console.log(`\n✅ Found ${allUsers.length} total users in socialmedia database:`);
    
    // Show all users to help identify Ayesha
    allUsers.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Full Name: ${user.fullName || user.full_name || user.name || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Profile Image: ${user.profileImage || 'NOT SET'}`);
      console.log(`   Avatar URL: ${user.avatar_url || 'NOT SET'}`);
      console.log(`   Avatar: ${user.avatar || 'NOT SET'}`);
      console.log(`   Created At: ${user.createdAt || user.created_at || 'N/A'}`);
      
      // Check avatar status
      const hasAvatar = user.profileImage || user.avatar_url || user.avatar;
      console.log(`   Avatar Status: ${hasAvatar ? '✅ HAS AVATAR' : '❌ NO AVATAR'}`);
      
      if (hasAvatar) {
        const avatarUrl = user.profileImage || user.avatar_url || user.avatar;
        console.log(`   Avatar URL: ${avatarUrl}`);
        
        // Check for potential issues
        if (!avatarUrl.startsWith('http')) {
          console.log(`   ⚠️  ISSUE: Avatar URL doesn't start with http/https`);
        }
        if (avatarUrl.includes('localhost')) {
          console.log(`   ⚠️  ISSUE: Avatar URL points to localhost`);
        }
        if (avatarUrl.includes(' ')) {
          console.log(`   ⚠️  ISSUE: Avatar URL contains spaces`);
        }
      }
    });
    
    // Look for users that might be Ayesha (case insensitive search)
    console.log('\n🎯 Searching for potential Ayesha matches...');
    const ayeshaMatches = allUsers.filter(user => {
      const username = (user.username || '').toLowerCase();
      const fullName = (user.fullName || user.full_name || user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      return username.includes('ayesha') || 
             username.includes('aisha') || 
             username.includes('aysha') ||
             fullName.includes('ayesha') || 
             fullName.includes('aisha') || 
             fullName.includes('aysha') ||
             email.includes('ayesha') ||
             email.includes('aisha') ||
             email.includes('aysha');
    });
    
    if (ayeshaMatches.length > 0) {
      console.log(`\n🎯 Found ${ayeshaMatches.length} potential Ayesha matches:`);
      ayeshaMatches.forEach((user, index) => {
        console.log(`\n💡 Match ${index + 1}:`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Full Name: ${user.fullName || user.full_name || user.name}`);
        console.log(`   Avatar Issue: ${!user.profileImage && !user.avatar_url && !user.avatar ? 'NO AVATAR SET' : 'Avatar exists'}`);
      });
    } else {
      console.log('\n❌ No users found matching "Ayesha" variations');
    }
    
    // Check for users with avatar issues
    console.log('\n🔍 Users with avatar issues:');
    const usersWithAvatarIssues = allUsers.filter(user => {
      return !user.profileImage && !user.avatar_url && !user.avatar;
    });
    
    console.log(`\n❌ Found ${usersWithAvatarIssues.length} users without avatars:`);
    usersWithAvatarIssues.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.fullName || user.full_name || user.name || 'No name'})`);
    });
    
  } catch (error) {
    console.error('❌ Error finding Ayesha in socialmedia database:', error);
  } finally {
    await client.close();
  }
}

// Run the search
findAyeshaInSocialMedia().catch(console.error);