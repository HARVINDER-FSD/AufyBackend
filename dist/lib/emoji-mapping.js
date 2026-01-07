"use strict";
// Emoji to Lottie Animation Mapping
// Using free Lottie animations from LottieFiles CDN
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickReactions = exports.emojiToLottieMap = void 0;
exports.getLottiePath = getLottiePath;
exports.hasAnimation = hasAnimation;
exports.getAllAnimatedEmojis = getAllAnimatedEmojis;
exports.getAnimatedEmojisByCategory = getAnimatedEmojisByCategory;
exports.emojiToLottieMap = {
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
};
// Quick reactions for chat (most commonly used)
exports.quickReactions = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '🎉'];
// Get Lottie path for emoji
function getLottiePath(emoji) {
    return exports.emojiToLottieMap[emoji] || null;
}
// Check if emoji has animation
function hasAnimation(emoji) {
    return emoji in exports.emojiToLottieMap;
}
// Get all animated emojis
function getAllAnimatedEmojis() {
    return Object.keys(exports.emojiToLottieMap);
}
// Get animated emojis by category
function getAnimatedEmojisByCategory(category) {
    const categories = {
        'Popular': exports.quickReactions,
        'All': Object.keys(exports.emojiToLottieMap),
    };
    return categories[category] || [];
}
