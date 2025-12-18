// AI Image Generation Service
// Supports: Hugging Face (FREE), Stability AI, DALL-E

/**
 * Generate image using AI
 * Priority: Pollinations.ai (FREE, no API key) → Hugging Face (FREE) → Stability AI (PAID)
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    // Try Pollinations.ai FIRST (FREE, no API key needed!)
    try {
      console.log('🎨 Using Pollinations.ai (FREE, no API key needed)');
      return await generateWithPollinations(prompt);
    } catch (pollinationsError: any) {
      console.log('⚠️ Pollinations.ai failed:', pollinationsError.message);
    }
    
    // Try Hugging Face (FREE, requires API key)
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    if (HF_API_KEY) {
      try {
        console.log('🎨 Using Hugging Face Image Generation (FREE)');
        return await generateWithHuggingFace(prompt, HF_API_KEY);
      } catch (hfError: any) {
        console.log('⚠️ Hugging Face failed:', hfError.message);
      }
    }
    
    // Try Stability AI (PAID)
    const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
    if (STABILITY_API_KEY) {
      try {
        console.log('🎨 Using Stability AI');
        return await generateWithStability(prompt, STABILITY_API_KEY);
      } catch (stabilityError: any) {
        console.log('⚠️ Stability AI failed:', stabilityError.message);
      }
    }
    
    // Fallback to placeholder
    console.log('💬 No image API available, returning placeholder');
    return generatePlaceholderImage(prompt);

  } catch (error: any) {
    console.error('❌ Image generation error:', error.message);
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Generate image using Hugging Face (FREE)
 * Models: black-forest-labs/FLUX.1-schnell (fastest, free)
 * Sign up: https://huggingface.co/settings/tokens
 */
async function generateWithHuggingFace(prompt: string, apiKey: string): Promise<string> {
  // Using Stable Diffusion 2.1 - reliable and fast
  const model = 'stabilityai/stable-diffusion-2-1';
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
  }

  // Response is image blob
  const imageBlob = await response.blob();
  
  // Convert blob to base64
  const arrayBuffer = await imageBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  console.log('✅ Hugging Face image generated');
  return `data:image/png;base64,${base64}`;
}

/**
 * Generate image using Stability AI (PAID)
 * Sign up: https://platform.stability.ai/
 */
async function generateWithStability(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: prompt,
            weight: 1
          },
          {
            text: 'blurry, bad quality, distorted',
            weight: -1
          }
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        steps: 30,
        samples: 1,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stability AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  
  if (!data.artifacts?.[0]?.base64) {
    throw new Error('No image from Stability AI');
  }

  console.log('✅ Stability AI image generated');
  return `data:image/png;base64,${data.artifacts[0].base64}`;
}

/**
 * Generate placeholder image URL
 */
function generatePlaceholderImage(prompt: string): string {
  // Use a placeholder service
  const encodedPrompt = encodeURIComponent(prompt.substring(0, 50));
  return `https://via.placeholder.com/512x512/667eea/ffffff?text=${encodedPrompt}`;
}

/**
 * Pollinations.ai (FREE, no API key needed!)
 * This is now the PRIMARY method - fast, reliable, and completely free
 */
async function generateWithPollinations(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true`;
  
  // Fetch the image to convert to base64
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new Error(`Pollinations.ai error: ${response.status}`);
  }
  
  // Convert to base64
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  console.log('✅ Pollinations.ai image generated');
  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Alternative FREE image generation APIs
 */

/**
 * Craiyon (formerly DALL-E mini) - FREE, no API key
 */
export async function generateWithCraiyon(prompt: string): Promise<string> {
  try {
    const response = await fetch('https://api.craiyon.com/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        version: 'c4ue22fb7kb6wlac',
        token: null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Craiyon API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    if (!data.images?.[0]) {
      throw new Error('No image from Craiyon');
    }

    // Craiyon returns base64 strings
    console.log('✅ Craiyon image generated');
    return `data:image/png;base64,${data.images[0]}`;
  } catch (error: any) {
    console.error('❌ Craiyon failed:', error.message);
    throw error;
  }
}
