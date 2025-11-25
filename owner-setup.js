// Owner Setup Script - Add golden badge to app owner
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');

// Owner username (already configured)
const OWNER_USERNAME = 'Its.harvinder.05';  // App owner: harvinder singh

console.log('👑 Owner Setup Script');
console.log('═══════════════════════════════════════\n');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB\n'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Define User schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  full_name: String,
  is_verified: Boolean,
  badge_type: String,
  verification_type: String,
  verification_date: Date,
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

async function setupOwner() {
  try {
    // Find owner by username
    const owner = await User.findOne({ username: OWNER_USERNAME });
    
    if (!owner) {
      console.log('❌ Owner account not found:', OWNER_USERNAME);
      console.log('\n💡 Available users:');
      const allUsers = await User.find({}).select('username email').limit(10);
      allUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.username} (${u.email})`);
      });
      console.log('\n⚠️  Edit OWNER_USERNAME in this file to match your account!\n');
      process.exit(1);
    }

    console.log('👤 Owner Account Found:');
    console.log('   Username:', owner.username);
    console.log('   Email:', owner.email);
    console.log('   Name:', owner.full_name || 'Not set');
    console.log('\n🏅 Adding Golden Badge (Owner Status)...\n');

    const result = await User.findByIdAndUpdate(
      owner._id,
      {
        $set: {
          is_verified: true,
          badge_type: 'gold',
          verification_type: 'gold',
          verification_date: new Date()
        }
      },
      { new: true }
    );

    if (result) {
      console.log('═══════════════════════════════════════');
      console.log('✨ OWNER BADGE ACTIVATED! ✨');
      console.log('═══════════════════════════════════════\n');
      console.log('👑 Owner:', result.username);
      console.log('📧 Email:', result.email);
      console.log('🟡 Badge: GOLD (Owner)');
      console.log('✅ Verified: YES');
      console.log('📅 Date:', result.verification_date.toLocaleString());
      console.log('\n💎 As the app owner, you now have:');
      console.log('   • Golden verification badge');
      console.log('   • Visible on all your content');
      console.log('   • Professional appearance');
      console.log('   • Owner status recognition');
      console.log('\n🔄 Restart your app to see the badge!\n');
    } else {
      console.log('❌ Update failed');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
setupOwner();
