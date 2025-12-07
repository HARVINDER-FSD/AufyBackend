const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function checkKrinaAvatar() {
  console.log('🔍 Checking Krina user avatar in database...\n');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Find Krina user
    const krinaUser = await db.collection('users').findOne({ username: 'krina' });

    if (!krinaUser) {
      console.log('❌ Krina user not found in database');
      await client.close();
      return;
    }

    console.log('✅ Found Krina user:');
    console.log('   _id:', krinaUser._id);
    console.log('   username:', krinaUser.username);
    console.log('   full_name:', krinaUser.full_name || krinaUser.name);
    console.log('\n📸 Avatar fields:');
    console.log('   avatar:', krinaUser.avatar);
    console.log('   avatar_url:', krinaUser.avatar_url);
    console.log('   profile_picture:', krinaUser.profile_picture);
    console.log('   profileImage:', krinaUser.profileImage);
    console.log('   profilePicture:', krinaUser.profilePicture);

    // Check if any avatar field exists
    const hasAvatar = krinaUser.avatar || krinaUser.avatar_url || krinaUser.profile_picture || krinaUser.profileImage || krinaUser.profilePicture;

    if (!hasAvatar) {
      console.log('\n⚠️ No avatar field found! Setting default avatar...');
      
      // Set default avatar
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(krinaUser.username)}&background=0095f6&color=fff&size=128`;
      
      await db.collection('users').updateOne(
        { _id: krinaUser._id },
        { 
          $set: { 
            avatar_url: defaultAvatar,
            avatar: defaultAvatar
          } 
        }
      );
      
      console.log('✅ Default avatar set:', defaultAvatar);
    } else {
      console.log('\n✅ Avatar field exists');
    }

    // Show all fields
    console.log('\n📋 All user fields:');
    console.log(JSON.stringify(krinaUser, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkKrinaAvatar();
