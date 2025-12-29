// Check detailed reel information to understand the ownership issue
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function checkReelDetails() {
  console.log('🔍 Checking Detailed Reel Information');
  console.log('====================================');
  
  try {
    // Get the specific reel details
    const reelId = '693e7712e109674a7d1e2d8b';
    console.log(`\n📋 Checking reel: ${reelId}`);
    
    // Method 1: Get reel via reels endpoint
    const reelsResponse = await fetch(`${API_BASE}/api/reels?username=its_harshit_01`);
    if (reelsResponse.ok) {
      const reelsData = await reelsResponse.json();
      if (reelsData.data && reelsData.data.length > 0) {
        const reel = reelsData.data[0];
        console.log('\n📊 Reel Details from /api/reels:');
        console.log('ID:', reel.id);
        console.log('Title/Description:', reel.title || reel.description || 'No title');
        console.log('Owner Username:', reel.user?.username);
        console.log('Owner ID:', reel.user?.id);
        console.log('Owner Name:', reel.user?.name || reel.user?.full_name);
        console.log('Video URL:', reel.video_url ? 'Present' : 'Missing');
        console.log('Thumbnail URL:', reel.thumbnail_url ? 'Present' : 'Missing');
        console.log('Created At:', reel.created_at);
        console.log('Likes:', reel.likes_count || 0);
        console.log('Comments:', reel.comments_count || 0);
        
        // Check if this matches your account
        console.log('\n🔍 Ownership Analysis:');
        console.log('Reel belongs to username:', reel.user?.username);
        console.log('You are logged in as: its_harshit_01');
        console.log('Is this your reel?', reel.user?.username === 'its_harshit_01' ? 'YES' : 'NO');
        
        if (reel.user?.username !== 'its_harshit_01') {
          console.log('❌ PROBLEM CONFIRMED: This reel belongs to someone else!');
          console.log('❌ Actual owner:', reel.user?.username);
          console.log('❌ But showing in its_harshit_01 profile');
        } else {
          console.log('✅ This reel correctly belongs to its_harshit_01');
          console.log('ℹ️ If you think this is wrong, you might have:');
          console.log('   - Created this reel and forgotten');
          console.log('   - Someone else used your account');
          console.log('   - There is a display issue in the mobile app');
        }
      }
    }
    
    // Method 2: Check user profile to see what they should have
    console.log('\n📋 Checking its_harshit_01 profile:');
    const profileResponse = await fetch(`${API_BASE}/api/users/username/its_harshit_01`);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const user = profileData.data || profileData;
      console.log('User ID:', user.id);
      console.log('Username:', user.username);
      console.log('Name:', user.name || user.full_name);
      console.log('Posts Count:', user.posts_count || 0);
      console.log('Account Created:', user.created_at || 'Unknown');
    }
    
    // Method 3: Check if there are any other users with similar names
    console.log('\n📋 Checking for similar usernames:');
    const similarUsers = ['harshit', 'its_harshit', 'harshit_01', 'its_harshit_1'];
    
    for (const username of similarUsers) {
      try {
        const userResponse = await fetch(`${API_BASE}/api/users/username/${username}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const user = userData.data || userData;
          console.log(`Found user: ${user.username} (ID: ${user.id})`);
          
          // Check if this user has reels
          const userReelsResponse = await fetch(`${API_BASE}/api/reels?username=${username}`);
          if (userReelsResponse.ok) {
            const userReelsData = await userReelsResponse.json();
            console.log(`  - Has ${userReelsData.data?.length || 0} reels`);
          }
        }
      } catch (error) {
        // User doesn't exist, skip
      }
    }
    
    console.log('\n🏁 Detailed Reel Check Complete');
    console.log('===============================');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

// Run the check
checkReelDetails();