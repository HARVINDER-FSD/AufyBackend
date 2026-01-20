
import axios from 'axios';

const TARGET_URL = process.env.TARGET_URL || 'https://aufybackend.onrender.com';

async function triggerIndexing() {
  console.log(`🚀 Triggering Database Indexing on ${TARGET_URL}...`);
  try {
    const res = await axios.post(`${TARGET_URL}/api/demo/create-indexes`);
    console.log('✅ Success:', res.data);
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
  }
}

triggerIndexing();
