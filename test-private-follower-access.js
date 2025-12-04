// Test that followers can view private account's followers/following
const API_URL = 'http://localhost:5001';

async function testFollowerAccess() {
  console.log('🧪 Testing Follower Access to Private Account...\n');

  const { MongoClient, ObjectId } = require('mongodb');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  
  // Get users
  const privateUser = await db.collection('users').findOne({ username: 'krinaprajapati24' });
  const followerUser = await db.collection('users').findOne({ username: 'its_monu_0207' });
  
  console.log(`Private user: ${privateUser.username} (${privateUser._id.toString()})`);
  console.log(`Follower user: ${followerUser.username} (${followerUser._id.toString()})`);
  
  // Make sure private user is private
  await db.collection('users').updateOne(
    { _id: privateUser._id },
    { $set: { is_private: true } }
  );
  
  // Create follow relationship (follower follows private user)
  const existingFollow = await db.collection('follows').findOne({
    followerId: followerUser._id,
    followingId: privateUser._id
  });
  
  if (!existingFollow) {
    await db.collection('follows').insertOne({
      followerId: followerUser._id,
      followingId: privateUser._id,
      status: 'accepted',
      createdAt: new Date()
    });
    console.log('✅ Created follow relationship');
  } else {
    console.log('✅ Follow relationship already exists');
  }
  
  await client.close();

  // Now test API access
  console.log('\n--- Testing follower access ---');
  
  // Login as follower
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: followerUser.email,
      password: 'Test123!'
    })
  });

  if (!loginResponse.ok) {
    console.log('❌ Login failed - cannot test');
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log(`✅ Logged in as ${followerUser.username}`);

  // Try to view private user's followers
  console.log(`\nTrying to view ${privateUser.username}'s followers...`);
  const followersResponse = await fetch(`${API_URL}/api/users/${privateUser._id.toString()}/followers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log(`Status: ${followersResponse.status}`);
  
  if (followersResponse.ok) {
    const data = await followersResponse.json();
    const followers = data.data || data;
    console.log(`✅ SUCCESS! Follower can view private account's followers`);
    console.log(`Found ${followers.length} followers`);
    if (followers.length > 0) {
      followers.forEach(f => console.log(`  - ${f.username}`));
    }
  } else {
    const error = await followersResponse.text();
    console.log(`❌ FAILED: ${error}`);
  }

  // Try to view private user's following
  console.log(`\nTrying to view ${privateUser.username}'s following...`);
  const followingResponse = await fetch(`${API_URL}/api/users/${privateUser._id.toString()}/following`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log(`Status: ${followingResponse.status}`);
  
  if (followingResponse.ok) {
    const data = await followingResponse.json();
    const following = data.data || data;
    console.log(`✅ SUCCESS! Follower can view private account's following`);
    console.log(`Found ${following.length} following`);
    if (following.length > 0) {
      following.forEach(f => console.log(`  - ${f.username}`));
    }
  } else {
    const error = await followingResponse.text();
    console.log(`❌ FAILED: ${error}`);
  }

  console.log('\n✅ Test completed!');
}

testFollowerAccess();
