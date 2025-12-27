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
