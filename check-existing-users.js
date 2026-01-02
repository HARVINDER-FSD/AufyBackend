const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

async function checkUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the User model
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Find some users
    const users = await User.find({}).limit(5).select('username email full_name');
    
    console.log('\n📋 Found users:');
    users.forEach(user => {
      console.log(`- Username: ${user.username}, Email: ${user.email}, Name: ${user.full_name}`);
    });
    
    // Check for specific users
    const specificUsers = ['krina', 'harvinder', 'harshit'];
    
    console.log('\n🔍 Checking specific users:');
    for (const username of specificUsers) {
      const user = await User.findOne({ username });
      if (user) {
        console.log(`✅ ${username}: Email = ${user.email}`);
      } else {
        console.log(`❌ ${username}: Not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsers();