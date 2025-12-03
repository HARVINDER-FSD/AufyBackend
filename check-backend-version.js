// Check if backend is deployed and up to date
const API_URL = 'https://aufybackend.onrender.com';

async function checkBackend() {
  console.log('🔍 Checking backend deployment status...\n');
  
  try {
    // Check if backend is responding
    const response = await fetch(`${API_URL}/health`);
    
    if (response.ok) {
      console.log('✅ Backend is online');
      const data = await response.json();
      console.log('   Status:', data.status || 'OK');
      console.log('   Timestamp:', new Date().toISOString());
    } else {
      console.log('⚠️  Backend returned:', response.status);
    }
  } catch (error) {
    console.log('❌ Backend is offline or unreachable');
    console.log('   Error:', error.message);
  }
  
  console.log('\n📝 Note: If you just pushed code to GitHub:');
  console.log('   1. Render auto-deploys from GitHub');
  console.log('   2. Deployment takes 2-5 minutes');
  console.log('   3. Check https://dashboard.render.com for deployment status');
  console.log('   4. Wait for "Live" status before testing\n');
  
  console.log('🔧 If settings endpoint returns 404:');
  console.log('   1. Backend needs to redeploy with latest code');
  console.log('   2. Go to Render dashboard');
  console.log('   3. Click "Manual Deploy" → "Deploy latest commit"');
  console.log('   4. Wait for deployment to complete\n');
}

checkBackend();
