"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTwistImage = generateTwistImage;
exports.regenerateTwistImage = regenerateTwistImage;
exports.generateImage = generateImage;
exports.generateWithPollinations = generateWithPollinations;
const axios_1 = __importDefault(require("axios"));
function generateTwistImage(prompt, style) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Use Pollinations.ai for free AI image generation
            const styleModifiers = {
                funny: 'cartoon style, humorous, exaggerated expressions',
                dramatic: 'cinematic, dramatic lighting, intense mood',
                realistic: 'photorealistic, detailed, natural lighting',
                cartoon: 'animated style, colorful, playful'
            };
            const fullPrompt = `${prompt}. ${styleModifiers[style] || styleModifiers.funny}`;
            // Pollinations.ai direct URL generation
            const encodedPrompt = encodeURIComponent(fullPrompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
            // Verify image is accessible
            yield axios_1.default.head(imageUrl);
            return imageUrl;
        }
        catch (error) {
            console.error('Image generation error:', error);
            // Fallback to placeholder
            return `https://via.placeholder.com/1024x1024/667eea/ffffff?text=${encodeURIComponent('AI Image')}`;
        }
    });
}
function regenerateTwistImage(twistId, newStyle) {
    return __awaiter(this, void 0, void 0, function* () {
        // Implementation for regenerating with different style
        return generateTwistImage('Regenerated image', newStyle);
    });
}
// Main image generation function for AI route
function generateImage(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🎨 Generating image with prompt:', prompt);
            // Use Pollinations.ai for free AI image generation
            const encodedPrompt = encodeURIComponent(prompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
            console.log('🎨 Generated image URL:', imageUrl);
            // Verify image is accessible
            yield axios_1.default.head(imageUrl, { timeout: 10000 });
            return imageUrl;
        }
        catch (error) {
            console.error('❌ Image generation error:', error);
            throw new Error('Failed to generate image');
        }
    });
}
// Pollinations.ai specific function
function generateWithPollinations(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🎨 Using Pollinations.ai for prompt:', prompt);
            const encodedPrompt = encodeURIComponent(prompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
            console.log('🎨 Pollinations URL:', imageUrl);
            // Test if image is accessible
            const response = yield axios_1.default.head(imageUrl, { timeout: 15000 });
            console.log('✅ Image verified, status:', response.status);
            return imageUrl;
        }
        catch (error) {
            console.error('❌ Pollinations error:', error);
            throw new Error('Pollinations.ai failed to generate image');
        }
    });
}
