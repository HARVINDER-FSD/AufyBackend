// Test the reels fixes: follow state and like persistence
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';
const EMAIL = 'hs8339952@gmail.com';
const PASSWORD = 'abc123';

async function testReelsFixes() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('✅ Logged in as:', loginData.user.username, '(ID:', userId, ')');

    // Test 1: Check follow state in reels
    console.log('\n📹 TEST 1: Checking follow state in reels...');
    const reelsResponse = await fetch(`${API_URL}/api/reels`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!reelsResponse.ok) {
      console.error('❌ Reels fetch failed:', await reelsResponse.text());
      return;
    }

    const reelsData = await reelsResponse.json();
    const reels = reelsData.data?.reels || reelsData.reels || reelsData.data || [];
    
    console.log(`✅ Got ${reels.length} reels\n`);

    // Get following list for comparison
    const followingResponse = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const followingData = await followingResponse.json();
    const following = Array.isArray(followingData) ? followingData : (followingData.data || []);
    const followingIds = following.map(f => f.id || f._id);
    
    console.log(`📋 You are following ${following.length} users`);
    console.log('Following IDs:', followingIds);

    // Check each reel's follow state
    let followStateCorrect = 0;
    let followStateIncorrect = 0;

    reels.forEach((reel, index) => {
      const reelUserId = reel.user?.id || reel.user?._id;
      const shouldBeFollowing = followingIds.includes(reelUserId);
      const backendSaysFollowing = reel.is_following || reel.user?.is_following || false;
      const isCorrect = shouldBeFollowing === backendSaysFollowing;

      if (isCorrect) {
        followStateCorrect++;
      } else {
        followStateIncorrect++;
        console.log(`❌ Reel ${index + 1} (${reel.user?.username}): Expected ${shouldBeFollowing}, got ${backendSaysFollowing}`);
      }
    });

    console.log(`\n✅ Follow state correct: ${followStateCorrect}/${reels.length}`);
    if (followStateIncorrect > 0) {
      console.log(`❌ Follow state incorrect: ${followStateIncorrect}/${reels.length}`);
    }

    // Test 2: Test like persistence
    if (reels.length > 0) {
      const testReel = reels[0];
      console.log(`\n📹 TEST 2: Testing like persistence on reel by ${testReel.user?.username}...`);
      console.log(`Initial state: liked=${testReel.is_liked}, likes=${testReel.likes_count}`);

      // Like the reel
      console.log('\n👍 Liking reel...');
      const likeResponse = await fetch(`${API_URL}/api/reels/${testReel.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!likeResponse.ok) {
        console.error('❌ Like failed:', await likeResponse.text());
      } else {
        const likeData = await likeResponse.json();
        console.log('✅ Like response:', likeData);
        console.log(`   Liked: ${likeData.liked}, Likes: ${likeData.likes}`);

        // Fetch reels again to verify persistence
        console.log('\n🔄 Fetching reels again to verify persistence...');
        const reelsResponse2 = await fetch(`${API_URL}/api/reels`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (reelsResponse2.ok) {
          const reelsData2 = await reelsResponse2.json();
          const reels2 = reelsData2.data?.reels || reelsData2.reels || reelsData2.data || [];
          const testReel2 = reels2.find(r => r.id === testReel.id);

          if (testReel2) {
            console.log(`✅ Reel found in fresh fetch`);
            console.log(`   Liked: ${testReel2.is_liked}, Likes: ${testReel2.likes_count}`);
            
            if (testReel2.is_liked === likeData.liked) {
              console.log('✅ Like state persisted correctly!');
            } else {
              console.log('❌ Like state NOT persisted!');
            }
          }
        }

        // Unlike to restore original state
        console.log('\n👎 Unliking reel to restore original state...');
        const unlikeResponse = await fetch(`${API_URL}/api/reels/${testReel.id}/like`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });

        if (unlikeResponse.ok) {
          const unlikeData = await unlikeResponse.json();
          console.log('✅ Unlike response:', unlikeData);
        }
      }
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReelsFixes();
