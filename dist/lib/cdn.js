"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDNOptimizer = void 0;
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
class CDNOptimizer {
    // Generate optimized image URL with transformations
    static getOptimizedImageUrl(publicId, options = {}) {
        const { width = 800, height = 600, quality = 'auto', format = 'auto', crop = 'fill', gravity = 'auto' } = options;
        return cloudinary_1.v2.url(publicId, {
            width,
            height,
            quality,
            format,
            crop,
            gravity,
            fetch_format: 'auto',
            flags: 'progressive'
        });
    }
    // Generate responsive image URLs for different screen sizes
    static getResponsiveImageUrls(publicId, baseOptions = {}) {
        const sizes = [
            { width: 320, height: 240, suffix: 'sm' },
            { width: 640, height: 480, suffix: 'md' },
            { width: 1024, height: 768, suffix: 'lg' },
            { width: 1920, height: 1080, suffix: 'xl' }
        ];
        return sizes.map(size => ({
            size: size.suffix,
            width: size.width,
            height: size.height,
            url: this.getOptimizedImageUrl(publicId, {
                ...baseOptions,
                width: size.width,
                height: size.height
            })
        }));
    }
    // Generate video thumbnail
    static getVideoThumbnail(publicId, options = {}) {
        const { width = 800, height = 600, time = 1 } = options;
        return cloudinary_1.v2.url(publicId, {
            resource_type: 'video',
            width,
            height,
            crop: 'fill',
            gravity: 'auto',
            format: 'jpg',
            quality: 'auto'
        });
    }
    // Generate video URL with optimizations
    static getOptimizedVideoUrl(publicId, options = {}) {
        const { width = 1280, height = 720, quality = 'auto', format = 'auto' } = options;
        return cloudinary_1.v2.url(publicId, {
            resource_type: 'video',
            width,
            height,
            quality,
            format,
            crop: 'fill',
            gravity: 'auto',
            flags: 'progressive'
        });
    }
    // Upload image with automatic optimization
    static async uploadImage(file, options = {}) {
        const { folder = 'social-media', publicId, tags = [], transformation = {
            width: 1200,
            height: 1200,
            crop: 'fill',
            gravity: 'auto',
            quality: 'auto',
            format: 'auto'
        } } = options;
        try {
            const result = await cloudinary_1.v2.uploader.upload(file, {
                folder,
                public_id: publicId,
                tags,
                transformation,
                resource_type: 'auto'
            });
            return {
                publicId: result.public_id,
                url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.bytes
            };
        }
        catch (error) {
            console.error('Error uploading image to Cloudinary:', error);
            throw error;
        }
    }
    // Upload video with automatic optimization
    static async uploadVideo(file, options = {}) {
        const { folder = 'social-media/videos', publicId, tags = [], transformation = {
            width: 1280,
            height: 720,
            crop: 'fill',
            gravity: 'auto',
            quality: 'auto',
            format: 'auto'
        } } = options;
        try {
            const result = await cloudinary_1.v2.uploader.upload(file, {
                folder,
                public_id: publicId,
                tags,
                transformation,
                resource_type: 'video'
            });
            return {
                publicId: result.public_id,
                url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.bytes,
                duration: result.duration
            };
        }
        catch (error) {
            console.error('Error uploading video to Cloudinary:', error);
            throw error;
        }
    }
    // Delete media from CDN
    static async deleteMedia(publicId, resourceType = 'image') {
        try {
            const result = await cloudinary_1.v2.uploader.destroy(publicId, {
                resource_type: resourceType
            });
            return result;
        }
        catch (error) {
            console.error('Error deleting media from Cloudinary:', error);
            throw error;
        }
    }
    // Generate image with text overlay (for stories, posts)
    static getImageWithText(publicId, text, options = {}) {
        const { width = 800, height = 600, textColor = 'white', backgroundColor = 'rgba(0,0,0,0.5)', fontSize = 24, fontFamily = 'Arial' } = options;
        return cloudinary_1.v2.url(publicId, {
            width,
            height,
            crop: 'fill',
            gravity: 'auto',
            overlay: {
                font_family: fontFamily,
                font_size: fontSize,
                font_weight: 'bold',
                text: text,
                text_align: 'center',
                color: textColor
            },
            flags: 'layer_apply'
        });
    }
    // Generate image with watermark
    static getImageWithWatermark(publicId, watermarkPublicId, options = {}) {
        const { width = 800, height = 600, opacity = 50, position = 'bottom_right' } = options;
        return cloudinary_1.v2.url(publicId, {
            width,
            height,
            crop: 'fill',
            gravity: 'auto',
            overlay: watermarkPublicId,
            opacity,
            gravity: position,
            flags: 'layer_apply'
        });
    }
    // Get media analytics
    static async getMediaAnalytics(publicId) {
        try {
            const result = await cloudinary_1.v2.api.resource(publicId, {
                resource_type: 'auto'
            });
            return {
                publicId: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                size: result.bytes,
                createdAt: result.created_at,
                url: result.secure_url
            };
        }
        catch (error) {
            console.error('Error getting media analytics:', error);
            throw error;
        }
    }
    // Generate multiple format URLs for progressive loading
    static getProgressiveImageUrls(publicId) {
        return {
            placeholder: this.getOptimizedImageUrl(publicId, {
                width: 50,
                height: 50,
                quality: 20,
                format: 'jpg'
            }),
            low: this.getOptimizedImageUrl(publicId, {
                width: 400,
                height: 300,
                quality: 60,
                format: 'webp'
            }),
            medium: this.getOptimizedImageUrl(publicId, {
                width: 800,
                height: 600,
                quality: 80,
                format: 'webp'
            }),
            high: this.getOptimizedImageUrl(publicId, {
                width: 1200,
                height: 900,
                quality: 'auto',
                format: 'webp'
            })
        };
    }
}
exports.CDNOptimizer = CDNOptimizer;
exports.default = CDNOptimizer;
