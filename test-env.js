const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
console.log('ENV file path:', envPath);
console.log('ENV file exists:', fs.existsSync(envPath));

const result = dotenv.config({ path: envPath });
console.log('Dotenv result:', result.parsed ? 'Loaded' : 'Failed');

if (result.parsed) {
  console.log('MONGODB_URI from .env:', result.parsed.MONGODB_URI?.substring(0, 50));
}

console.log('process.env.MONGODB_URI:', process.env.MONGODB_URI?.substring(0, 50));
