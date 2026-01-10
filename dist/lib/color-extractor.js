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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDominantColor = extractDominantColor;
exports.getContrastColor = getContrastColor;
exports.darkenColor = darkenColor;
exports.lightenColor = lightenColor;
// Extract dominant color from image for sticker theming
function extractDominantColor(imageSrc) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve('#8b5cf6'); // fallback purple
                        return;
                    }
                    // Sample from center of image
                    const size = 50;
                    canvas.width = size;
                    canvas.height = size;
                    ctx.drawImage(img, 0, 0, size, size);
                    const imageData = ctx.getImageData(0, 0, size, size).data;
                    // Calculate average color
                    let r = 0, g = 0, b = 0;
                    const pixelCount = size * size;
                    for (let i = 0; i < imageData.length; i += 4) {
                        r += imageData[i];
                        g += imageData[i + 1];
                        b += imageData[i + 2];
                    }
                    r = Math.floor(r / pixelCount);
                    g = Math.floor(g / pixelCount);
                    b = Math.floor(b / pixelCount);
                    // Convert to hex
                    const toHex = (n) => n.toString(16).padStart(2, '0');
                    const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                    resolve(hexColor);
                }
                catch (error) {
                    console.error('Color extraction error:', error);
                    resolve('#8b5cf6'); // fallback purple
                }
            };
            img.onerror = () => {
                resolve('#8b5cf6'); // fallback purple
            };
            img.src = imageSrc;
        });
    });
}
// Get contrasting text color (black or white) based on background
function getContrastColor(hexColor) {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Return black for light backgrounds, white for dark
    return luminance > 0.5 ? '#000000' : '#ffffff';
}
// Darken color for better contrast
function darkenColor(hexColor, amount = 0.2) {
    const hex = hexColor.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
    const toHex = (n) => Math.floor(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
// Lighten color
function lightenColor(hexColor, amount = 0.2) {
    const hex = hexColor.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + (255 - parseInt(hex.substr(0, 2), 16)) * amount);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + (255 - parseInt(hex.substr(2, 2), 16)) * amount);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + (255 - parseInt(hex.substr(4, 2), 16)) * amount);
    const toHex = (n) => Math.floor(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
