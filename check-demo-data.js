// Check if demo data exists on production
const API_URL = 'https://aufybackend.onrender.com'

async function checkDemoData() {
  console.log('🔍 Checking demo data on production...')
  console.log('API URL:', API_URL)
  console.log('')
  
  try {
    // First check if API is up
    console.log('1️⃣ Checking API health...')
    const healthResponse = await fetch(`${API_URL}/health`)
    
    if (!healthResponse.ok) {
      console.log('⚠️  API is not responding properly')
      console.log('   Status:', healthResponse.status)
      console.log('   This might mean Render is still deploying...')
      return
    }
    
    console.log('✅ API is healthy')
    console.log('')
    
    // Check demo data stats
    console.log('2️⃣ Checking demo data stats...')
    const statsResponse = await fetch(`${API_URL}/api/demo/stats`)
    
    if (!statsResponse.ok) {
      console.log('❌ Failed to get demo stats')
      console.log('   Status:', statsResponse.status)
      const text = await statsResponse.text()
      console.log('   Response:', text.substring(0, 200))
      return
    }
    
    const stats = await statsResponse.json()
    
    if (stats.success) {
      console.log('✅ Demo data stats retrieved:')
      console.log('')
      console.log('   📊 Demo User Exists:', stats.data.demo_user_exists ? '✅ Yes' : '❌ No')
      console.log('   📸 Posts Count:', stats.data.posts_count)
      console.log('   🎬 Reels Count:', stats.data.reels_count)
      console.log('')
      
      if (!stats.data.demo_user_exists) {
        console.log('💡 To seed demo data, run:')
        console.log('   node seed-demo-data.js seed')
      } else if (stats.data.posts_count === 0 && stats.data.reels_count === 0) {
        console.log('⚠️  Demo user exists but no content found')
        console.log('💡 To seed demo data, run:')
        console.log('   node seed-demo-data.js seed')
      } else {
        console.log('✅ Demo data is ready!')
      }
    } else {
      console.log('❌ Error:', stats.error)
    }
  } catch (error) {
    console.error('❌ Error checking demo data:', error.message)
    console.log('')
    console.log('💡 This might mean:')
    console.log('   - Render is still deploying the latest changes')
    console.log('   - The API is temporarily unavailable')
    console.log('   - Network connectivity issues')
    console.log('')
    console.log('   Wait a minute and try again!')
  }
}

checkDemoData()
