// Script to re-hash passwords with faster bcrypt rounds (8 instead of 10)
// Run this once to speed up login for existing users
import dotenv from 'dotenv'
import path from 'path'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia'

async function optimizePasswords() {
  console.log('🔧 Optimizing user passwords for faster login...')
  
  const client = await MongoClient.connect(MONGODB_URI)
  const db = client.db()
  const users = await db.collection('users').find({}).toArray()
  
  console.log(`Found ${users.length} users`)
  
  let updated = 0
  for (const user of users) {
    // Check if password is already using 8 rounds (starts with $2a$08$ or $2b$08$)
    if (user.password && !user.password.startsWith('$2a$08$') && !user.password.startsWith('$2b$08$')) {
      // This is a placeholder - in production you'd need the original password
      // For now, just log which users need updating
      console.log(`User ${user.username} needs password update`)
      updated++
    }
  }
  
  await client.close()
  
  console.log(`✅ ${updated} users would benefit from password re-hashing`)
  console.log('Note: Users will automatically get faster hashes on next password change')
}

optimizePasswords().catch(console.error)
