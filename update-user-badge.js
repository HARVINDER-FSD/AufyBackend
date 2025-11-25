// Interactive script to add verification badge to any user
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
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

const BADGE_TYPES = {
  '1': { type: 'blue', name: 'Blue Badge (Creator/Influencer)' },
  '2': { type: 'gold', name: 'Gold Badge (Business/Brand)' },
  '3': { type: 'purple', name: 'Purple Badge (Premium Creator)' },
  '4': { type: 'gray', name: 'Gray Badge (Government/Official)' },
  '5': { type: 'green', name: 'Green Badge (Organization/Non-profit)' },
};

async function updateUserBadge() {
  try {
    // Find all users
    const users = await User.find({}).select('username email full_name is_verified badge_type').limit(20);
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      process.exit(1);
    }

    console.log('\n📋 Available users:\n');
    users.forEach((user, index) => {
      const badge = user.badge_type ? `${user.badge_type} ✓` : 'none';
      console.log(`${index + 1}. @${user.username} - ${user.full_name || 'No name'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Badge: ${badge}\n`);
    });

    // Ask which user to update
    rl.question('Enter user number to update (or username): ', async (answer) => {
      let selectedUser;
      
      if (!isNaN(answer)) {
        const index = parseInt(answer) - 1;
        selectedUser = users[index];
      } else {
        selectedUser = users.find(u => u.username === answer);
      }

      if (!selectedUser) {
        console.log('❌ Invalid selection');
        rl.close();
        process.exit(1);
      }

      console.log(`\n🎯 Selected: @${selectedUser.username}\n`);
      console.log('Choose badge type:\n');
      Object.entries(BADGE_TYPES).forEach(([key, badge]) => {
        console.log(`${key}. ${badge.name}`);
      });
      console.log('0. Remove badge\n');

      rl.question('Enter badge number: ', async (badgeChoice) => {
        let updateData;

        if (badgeChoice === '0') {
          updateData = {
            is_verified: false,
            badge_type: null,
            verification_type: null,
            verification_date: null
          };
        } else {
          const badge = BADGE_TYPES[badgeChoice];
          if (!badge) {
            console.log('❌ Invalid badge choice');
            rl.close();
            process.exit(1);
          }

          updateData = {
            is_verified: true,
            badge_type: badge.type,
            verification_type: badge.type,
            verification_date: new Date()
          };
        }

        const result = await User.findOneAndUpdate(
          { username: selectedUser.username },
          { $set: updateData },
          { new: true }
        );

        if (result) {
          console.log('\n✅ SUCCESS! Badge updated for:', result.username);
          console.log('👤 Full Name:', result.full_name);
          console.log('📧 Email:', result.email);
          console.log('🏅 Badge Type:', result.badge_type || 'none');
          console.log('✓ Verified:', result.is_verified);
          if (result.verification_date) {
            console.log('📅 Verification Date:', result.verification_date);
          }
        } else {
          console.log('❌ Update failed');
        }

        rl.close();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Error:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the script
updateUserBadge();
