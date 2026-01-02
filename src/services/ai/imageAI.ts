import axios from 'axios';

export async function generateTwistImage(prompt: string, style: string): Promise<string> {
  try {
    // Use Pollinations.ai for free AI image generation
    const styleModifiers = {
      funny: 'cartoon style, humorous, exaggerated expressions',
      dramatic: 'cinematic, dramatic lighting, intense mood',
      realistic: 'photorealistic, detailed, natural lighting',
      cartoon: 'animated style, colorful, playful'
    };

    const fullPrompt = `${prompt}. ${styleModifiers[style as keyof typeof styleModifiers] || styleModifiers.funny}`;
    
    // Pollinations.ai direct URL generation
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

    // Verify image is accessible
    await axios.head(imageUrl);

    return imageUrl;
  } catch (error) {
    console.error('Image generation error:', error);
    
    // Fallback to placeholder
    return `https://via.placeholder.com/1024x1024/667eea/ffffff?text=${encodeURIComponent('AI Image')}`;
  }
}

export async function regenerateTwistImage(twistId: string, newStyle: string): Promise<string> {
  // Implementation for regenerating with different style
  return generateTwistImage('Regenerated image', newStyle);
}

// Main image generation function for AI route
export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log('🎨 Generating image with prompt:', prompt);
    
    // Use Pollinations.ai for free AI image generation
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

    console.log('🎨 Generated image URL:', imageUrl);

    // Verify image is accessible
    await axios.head(imageUrl, { timeout: 10000 });

    return imageUrl;
  } catch (error) {
    console.error('❌ Image generation error:', error);
    throw new Error('Failed to generate image');
  }
}

// Pollinations.ai specific function
export async function generateWithPollinations(prompt: string): Promise<string> {
  try {
    console.log('🎨 Using Pollinations.ai for prompt:', prompt);
    
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

    console.log('🎨 Pollinations URL:', imageUrl);

    // Test if image is accessible
    const response = await axios.head(imageUrl, { timeout: 15000 });
    console.log('✅ Image verified, status:', response.status);

    return imageUrl;
  } catch (error) {
    console.error('❌ Pollinations error:', error);
    throw new Error('Pollinations.ai failed to generate image');
  }
}
