// Test Hugging Face Image Generation
const fetch = require('node-fetch');
const fs = require('fs');
require('dotenv').config();

async function testImageGeneration() {
  console.log('\n🎨 Testing Hugging Face Image Generation\n');
  
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  console.log('API Key:', HF_API_KEY ? '✅ Set' : '❌ Not set');
  
  if (!HF_API_KEY) {
    console.error('❌ HUGGINGFACE_API_KEY not found in .env');
    return;
  }
  
  const testPrompts = 