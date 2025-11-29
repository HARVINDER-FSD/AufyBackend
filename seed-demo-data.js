// Script to seed demo data to the API
const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com'

async function seedDemoData() {
  console.log('🌱 Seeding demo data...')
  console.log('API URL:', API_URL)
  
  try {
    const response = await fetch(`${API_URL}/api/demo/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Demo data seeded successfully!')
      console.log(`📸 Posts created: ${data.data.posts_created}`)
      console.log(`🎬 Reels created: ${data.data.reels_created}`)
      console.log(`👤 Demo user: @${data.data.demo_user.username}`)
    } else {
      console.error('❌ Failed to seed demo data:', data.error)
    }
  } catch (error) {
    console.error('❌ Error seeding demo data:', error.message)
  }
}

async function getDemoStats() {
  console.log('📊 Getting demo data stats...')
  
  try {
    const response = await fetch(`${API_URL}/api/demo/stats`)
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Demo data stats:')
      console.log(`   Demo user exists: ${data.data.demo_user_exists}`)
      console.log(`   Posts: ${data.data.posts_count}`)
      console.log(`   Reels: ${data.data.reels_count}`)
    }
  } catch (error) {
    console.error('❌ Error getting stats:', error.message)
  }
}

async function clearDemoData() {
  console.log('🗑️  Clearing demo data...')
  
  try {
    const response = await fetch(`${API_URL}/api/demo/clear`, {
      method: 'DELETE'
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Demo data cleared successfully!')
      console.log(`   Posts deleted: ${data.data.posts_deleted}`)
      console.log(`   Reels deleted: ${data.data.reels_deleted}`)
    }
  } catch (error) {
    console.error('❌ Error clearing demo data:', error.message)
  }
}

// Main
const command = process.argv[2]

switch (command) {
  case 'seed':
    seedDemoData()
    break
  case 'stats':
    getDemoStats()
    break
  case 'clear':
    clearDemoData()
    break
  default:
    console.log('Usage:')
    console.log('  node seed-demo-data.js seed   - Add 200 demo posts and reels')
    console.log('  node seed-demo-data.js stats  - Check demo data stats')
    console.log('  node seed-demo-data.js clear  - Remove all demo data')
}
