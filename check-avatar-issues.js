const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function checkAvatarIssues() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Checking avatar issues');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Get all users
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`\n✅ Found ${allUsers.length} total users`);
    
    // Look for Ayesha specifically
    const ayeshaUsers = allUsers.filter(user => {
      const username = (user.username || '').toLowerCase();
      const fullName = (user.fullName || user.full_name || user.name || '').toLowerCase();
      
      return username.includes('ayesha') || 
             username.includes('aisha') || 
             fullName.includes('ayesha') || 
             fullName.includes('aisha');
    });
    
    console.log(`\n🎯 Found ${ayeshaUsers.length} users matching Ayesha:`);
    
    if (ayeshaUsers.length > 0) {
      ayeshaUsers.forEach((user, index) => {
        console.log(`\n👤 Ayesha User ${index + 1}:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Full Name: ${user.fullName || user.full_name || user.name}`);
        console.log(`   Profile Image: ${user.profileImage || 'NOT SET'}`);
        console.log(`   Avatar URL: ${user.avatar_url || 'NOT SET'}`);
        console.log(`   Avatar: ${user.avatar || 'NOT SET'}`);
        
        // Determine avatar status
        const avatarUrl = user.profileImage || user.avatar_url || user.avatar;
        if (!avatarUrl) {
          console.log(`   🚨 ISSUE: NO AVATAR SET - This user will show fallback avatar`);
          console.log(`   📝 Fallback URL: https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&background=0095f6&color=fff&size=128`);
        } else {
          console.log(`   ✅ Avatar URL exists: ${avatarUrl}`);
          
          // Check for common issues
          if (!avatarUrl.startsWith('http')) {
            console.log(`   ⚠️  ISSUE: Avatar URL missing protocol (http/https)`);
          }
          if (avatarUrl.includes('localhost') || avatarUrl.includes('127.0.0.1')) {
            console.log(`   ⚠️  ISSUE: Avatar URL points to localhost (won't work on mobile)`);
          }
          if (avatarUrl.includes(' ')) {
            console.log(`   ⚠️  ISSUE: Avatar URL contains spaces`);
          }
          if (avatarUrl.length > 500) {
            console.log(`   ⚠️  ISSUE: Avatar URL is very long (${avatarUrl.length} chars)`);
          }
        }
      });
    } else {
      console.log('\n❌ No users found with "Ayesha" in name');
      console.log('\n📝 All usernames in database:');
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username} (${user.fullName || user.full_name || user.name || 'No name'})`);
      });
    }
    
    // Check for general avatar issues
    console.log('\n🔍 General avatar issues analysis:');
    const usersWithoutAvatars = allUsers.filter(user => !user.profileImage && !user.avatar_url && !user.avatar);
    const usersWithInvalidAvatars = allUsers.filter(user => {
      const avatarUrl = user.profileImage || user.avatar_url || user.avatar;
      return avatarUrl && (!avatarUrl.startsWith('http') || avatarUrl.includes('localhost'));
    });
    
    console.log(`   Users without avatars: ${usersWithoutAvatars.length}`);
    console.log(`   Users with invalid avatar URLs: ${usersWithInvalidAvatars.length}`);
    
    if (usersWithInvalidAvatars.length > 0) {
      console.log('\n⚠️  Users with invalid avatar URLs:');
      usersWithInvalidAvatars.forEach(user => {
        const avatarUrl = user.profileImage || user.avatar_url || user.avatar;
        console.log(`   ${user.username}: ${avatarUrl}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking avatar issues:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkAvatarIssues().catch(console.error);