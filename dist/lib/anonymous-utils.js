"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskAnonymousUser = exports.generateAnonymousPersona = void 0;
const generateAnonymousPersona = () => {
    const adjectives = ['Secret', 'Hidden', 'Misty', 'Silent', 'Ghost', 'Shadow', 'Dark', 'Bright', 'Golden', 'Silver', 'Mystic', 'Noble', 'Brave', 'Cunning', 'Swift'];
    const creatures = ['Wolf', 'Eagle', 'Tiger', 'Lion', 'Falcon', 'Owl', 'Panda', 'Shark', 'Lynx', 'Phoenix', 'Dragon', 'Ninja', 'Samurai', 'Knight'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const creature = creatures[Math.floor(Math.random() * creatures.length)];
    const number = Math.floor(Math.random() * 9999) + 1;
    return {
        name: `${adj} ${creature}`,
        username: `${adj}_${creature}_${number}`.toLowerCase(),
        avatar: `https://ui-avatars.com/api/?name=${adj}+${creature}&background=random&color=fff&size=200`
    };
};
exports.generateAnonymousPersona = generateAnonymousPersona;
const maskAnonymousUser = (user) => {
    var _a;
    if (!user.isAnonymousMode && !user.is_anonymous)
        return {
            id: ((_a = user._id) === null || _a === void 0 ? void 0 : _a.toString()) || user.id,
            username: user.username,
            full_name: user.full_name || user.name,
            avatar_url: user.avatar_url || user.avatar,
            is_verified: user.is_verified || false,
            badge_type: user.badge_type || null
        };
    const persona = user.anonymousPersona || {
        name: 'Ghost User',
        username: 'anonymous',
        avatar: 'https://ui-avatars.com/api/?name=Ghost+User&background=333&color=fff'
    };
    return {
        id: 'anonymous',
        username: persona.username,
        full_name: persona.name,
        avatar_url: persona.avatar,
        is_verified: false,
        badge_type: null,
        is_anonymous: true
    };
};
exports.maskAnonymousUser = maskAnonymousUser;
