import axios from 'axios';

const BASE_URL = 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;

async function getAuthToken(prefix: string) {
  const timestamp = Date.now();
  const email = `${prefix}_${timestamp}@example.com`;
  const password = 'Password123!';
  const username = `${prefix}_user_${timestamp}`;

  try {
    await axios.post(`${API_URL}/auth/register`, {
      email,
      password,
      username,
      name: `${prefix} Test User`,
      dob: '2000-01-01'
    });
  } catch (error: any) {
  }

  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    email,
    password
  });

  return { token: loginRes.data.token as string, userId: loginRes.data.user._id as string };
}

async function debugChat() {
  console.log('🚀 Debugging Chat Creation...');
  
  const user1 = await getAuthToken('debug1');
  const user2 = await getAuthToken('debug2');
  
  const authHeaders = { headers: { Authorization: `Bearer ${user1.token}` } };

  console.log(`User1: ${user1.userId}`);
  console.log(`User2: ${user2.userId}`);

  try {
    console.log('Sending create conversation request...');
    const convRes = await axios.post(`${API_URL}/chat/conversations`, { userId: user2.userId }, authHeaders);
    console.log('Success:', convRes.data);
  } catch (err: any) {
    console.error('Failed to create conversation:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

debugChat().catch(console.error);