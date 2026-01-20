
import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_URL = 'http://localhost:5001/api';

async function testFeedPerf() {
  try {
    // 1. Register/Login
    const email = faker.internet.email();
    const password = 'password123';
    
    console.log('Registering user...');
    await axios.post(`${API_URL}/auth/register`, {
      email,
      password,
      username: faker.internet.username(),
      full_name: faker.person.fullName(),
      dob: '2000-01-01'
    });

    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });

    const token = loginRes.data.token;
    console.log('Logged in.');

    // 2. Hit Feed
    console.log('Fetching Feed...');
    const start = Date.now();
    await axios.get(`${API_URL}/feed/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Feed fetched in ${Date.now() - start}ms`);

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testFeedPerf();
