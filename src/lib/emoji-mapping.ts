// Emoji to Lottie Animation Mapping
// Using free Lottie animations from LottieFiles CDN

export const emojiToLottieMap: Record<string, string> = {
  // Popular reactions - using LottieFiles public animations
  '❤️': 'https://assets9.lottiefiles.com/packages/lf20_2glqweqy.json',
  '😂': 'https://assets9.lottiefiles.com/packages/lf20_qjogjks0.json',
  '😮': 'https://assets9.lottiefiles.com/packages/lf20_wd1udlcz.json',
  '😢': 'https://assets9.lottiefiles.com/packages/lf20_ystsffqy.json',
  '😡': 'https://assets9.lottiefiles.com/packages/lf20_pqnfmone.json',
  '👍': 'https://assets9.lottiefiles.com/packages/lf20_myejiggj.json',
  '🙏': 'https://assets9.lottiefiles.com/packages/lf20_8wREk3.json',
  '🔥': 'https://assets9.lottiefiles.com/packages/lf20_yyytpfta.json',
  '🎉': 'https://assets9.lottiefiles.com/packages/lf20_rovf9gzu.json',
  '💯': 'https://assets9.lottiefiles.com/packages/lf20_zrqthn6o.json',
  '😍': 'https://assets9.lottiefiles.com/packages/lf20_2glqweqy.json',
  '🤔': 'https://assets9.lottiefiles.com/packages/lf20_wd1udlcz.json',
  '😎': 'https://assets9.lottiefiles.com/packages/lf20_qjogjks0.json',
  '🤗': 'https://assets9.lottiefiles.com/packages/lf20_2glqweqy.json',
  '😘': 'https://assets9.lottiefiles.com/packages/lf20_2glqweqy.json',
  '🥳': 'https://assets9.lottiefiles.com/packages/lf20_rovf9gzu.json',
}

// Quick reactions for chat (most commonly used)
export const quickReactions = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '🎉']

// Get Lottie path for emoji
export function getLottiePath(emoji: string): string | null {
  return emojiToLottieMap[emoji] || null
}

// Check if emoji has animation
export function hasAnimation(emoji: string): boolean {
  return emoji in emojiToLottieMap
}

// Get all animated emojis
export function getAllAnimatedEmojis(): string[] {
  return Object.keys(emojiToLottieMap)
}

// Get animated emojis by category
export function getAnimatedEmojisByCategory(category: string): string[] {
  const categories: Record<string, string[]> = {
    'Popular': quickReactions,
    'All': Object.keys(emojiToLottieMap),
  }
  return categories[category] || []
}
