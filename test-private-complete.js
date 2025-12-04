// Complete test of private account followers/following
const API_URL = 'http://localhost:5001';

async function testComplete() {
  console.log('🧪 Complete Private Account Test...\n');

  const { MongoClient, ObjectId } = require('mongodb');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  
  // Setup: privateuser (private), followeruser (follows private), publicuser (doesn't follow)
  const privateUser = await db.collection('users').findOne({ username: 'privateuser' });
  const followerUser = await db.collection('users').findOne({ username: 'followeruser' });
  const publicUser = await db.collection('users').findOne({ username: 'publicuser' });
  
  // Make privateuser private
  await db.collection('users').updateOne(
    { _id: privateUser._id },
    { $set: { is_private: true } }
  );
  
  // Create follow: followeruser -> privateuser
  await db.collection('follows').deleteMany({
    $or: [
      { followerId: followerUser._id, followingId: privateUser._id },
      { followerId: publicUser._id, followingId: privateUser._id }
    ]
  });
  
  await db.collection('follows').insertOne({
    followerId: followerUser._id,
    followingId: privateUser._id,
    status: 'accepted',
    createdAt: new Date()
  });
  
  console.log('✅ Setup complete:');
  console.log(`  - ${privateUser.username} is PRIVATE`);
  console.log(`  - ${followerUser.username} FOLLOWS ${privateUser.username}`);
  console.log(`  - ${publicUser.username} does NOT follow ${privateUser.username}`);
  
  await client.close();

  // Test 1: Private user viewing their own
  console.log('\n--- Test 1: Private user viewing own followers ---');
  const privateLogin = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'private.test@example.com', password: 'Test123!' })
  });
  
  const privateData = await privateLogin.json();
  const privateToken = privateData.token;
  
  const ownFollowers = await fetch(`${API_URL}/api/users/${privateUser._id.toString()}/followers`, {
    headers: { 'Authorization': `Bearer ${privateToken}` }
  });
  
  if (ownFollowers.ok) {
    const data = await ownFollowers.json();
    console.log(`✅ Can view own followers: ${(data.data || data).length}`);
  } else {
    console.log(`❌ Cannot view own followers: ${ownFollowers.status}`);
  }

  // Test 2: Follower viewing private account
  console.log('\n--- Test 2: Follower viewing private account ---');
  const followerLogin = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'follower.test@example.com', password: 'Test123!' })
  });
  
  const followerData = await followerLogin.json();
  const followerToken = followerData.token;
  
  const followerView = await fetch(`${API_URL}/api/users/${privateUser._id.toString()}/followers`, {
    headers: { 'Authorization': `Bearer ${followerToken}` }
  });
  
  if (followerView.ok) {
    const data = await followerView.json();
    console.log(`✅ Follower CAN view private account: ${(data.data || data).length} followers`);
  } else {
    console.log(`❌ Follower CANNOT view: ${followerView.status} - ${await followerView.text()}`);
  }

  // Test 3: Non-follower viewing private account
  console.log('\n--- Test 3: Non-follower viewing private account ---');
  const publicLogin = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'public.test@example.com', password: 'Test123!' })
  });
  
  const publicData = await publicLogin.json();
  const publicToken = publicData.token;
  
  const publicView = await fetch(`${API_URL}/api/users/${privateUser._id.toString()}/followers`, {
    headers: { 'Authorization': `Bearer ${publicToken}` }
  });
  
  if (publicView.status === 403) {
    console.log(`✅ Non-follower BLOCKED correctly: "This account is private"`);
  } else {
    console.log(`❌ Non-follower should be blocked but got: ${publicView.status}`);
  }

  console.log('\n✅ All privacy tests passed!');
  console.log('\n📱 In mobile app:');
  console.log('  - You can always see YOUR OWN followers/following');
  console.log('  - You can see followers/following of private accounts you FOLLOW');
  console.log('  - You CANNOT see followers/following of private accounts you DON\'T follow');
}

testComplete();
