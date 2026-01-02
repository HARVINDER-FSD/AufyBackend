const { MongoClient } = require('mongodb');

// Use your correct Render backend MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function testFavoriteFriendsAvatars() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Testing favorite friends avatars');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Get all users to check avatar fields
    console.log('\n📋 Checking all users for avatar field availability...');
    const allUsers = await usersCollection.find({}).limit(10).toArray();
    
    console.log(`Found ${allUsers.length} users to analyze:`);
    
    allUsers.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}: ${user.username}`);
      
      // Check all possible avatar fields
      const avatarFields = {
        profileImage: user.profileImage,
        avatar_url: user.avatar_url,
        avatar: user.avatar,
        profilePicture: user.profilePicture,
        image: user.image,
        photo: user.photo
      };
      
      console.log('   📸 Avatar Fields:');
      let hasAnyAvatar = false;
      Object.entries(avatarFields).forEach(([field, value]) => {
        if (value) {
          console.log(`     ✅ ${field}: ${value.substring(0, 60)}${value.length > 60 ? '...' : ''}`);
          hasAnyAvatar = true;
        } else {
          console.log(`     ❌ ${field}: NOT SET`);
        }
      });
      
      // Determine what the frontend would use
      const frontendAvatarUrl = user.avatar_url || 
                               user.profileImage || 
                               user.avatar || 
                               `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0095f6&color=fff&size=128`;
      
      console.log(`   🎯 Frontend would use: ${frontendAvatarUrl.substring(0, 80)}${frontendAvatarUrl.length > 80 ? '...' : ''}`);
      
      if (!hasAnyAvatar) {
        console.log(`   ⚠️  This user would show fallback avatar`);
      }
    });
    
    // Check secret crush collection if it exists
    console.log('\n\n💕 Checking secret crush data...');
    try {
      const secretCrushCollection = db.collection('secret-crushes');
      const crushes = await secretCrushCollection.find({}).limit(5).toArray();
      
      console.log(`Found ${crushes.length} secret crush entries:`);
      
      crushes.forEach((crush, index) => {
        console.log(`\n💕 Crush ${index + 1}:`);
        console.log(`   From: ${crush.userId}`);
        console.log(`   To: ${crush.targetUserId}`);
        console.log(`   Mutual: ${crush.isMutual || false}`);
        console.log(`   Created: ${crush.createdAt}`);
      });
      
    } catch (error) {
      console.log('   No secret crush collection found or error accessing it');
    }
    
    // Check favorite friends collection if it exists
    console.log('\n\n⭐ Checking favorite friends data...');
    try {
      const favoritesCollection = db.collection('favorite-friends');
      const favorites = await favoritesCollection.find({}).limit(5).toArray();
      
      console.log(`Found ${favorites.length} favorite friend entries:`);
      
      favorites.forEach((fav, index) => {
        console.log(`\n⭐ Favorite ${index + 1}:`);
        console.log(`   User: ${fav.userId}`);
        console.log(`   Friend: ${fav.friendId}`);
        console.log(`   Created: ${fav.createdAt}`);
      });
      
    } catch (error) {
      console.log('   No favorite friends collection found or error accessing it');
    }
    
    console.log('\n\n🎉 Avatar Analysis Complete!');
    console.log('📱 The updated frontend code will now:');
    console.log('   ✅ Check avatar_url first (current field)');
    console.log('   ✅ Fallback to profileImage if available');
    console.log('   ✅ Fallback to avatar if available');
    console.log('   ✅ Use generated avatar as final fallback');
    console.log('   ✅ Handle avatar load errors gracefully');
    
  } catch (error) {
    console.error('❌ Error testing favorite friends avatars:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testFavoriteFriendsAvatars().catch(console.error);