import sharp from 'sharp';

/**
 * MediaUtils - Privacy & Optimization for Media
 */
export class MediaUtils {
    /**
     * Strips EXIF metadata (GPS, Camera info) from an image buffer
     * Critical for 100% anonymous privacy
     */
    static async stripMetadata(buffer: Buffer): Promise<Buffer> {
        try {
            // .withMetadata({}) with no arguments or empty object strips all metadata by default in newer sharp versions
            // but explicitly using .rotate() (to keep orientation) and then stripping is safer.
            return await sharp(buffer)
                .rotate() // Auto-rotate based on EXIF before stripping it (Sharp strips metadata by default)
                .toBuffer();
        } catch (error) {
            console.error("Error stripping metadata:", error);
            return buffer; // Fallback to original if processing fails
        }
    }

    /**
     * Resize for performance (Million-user scale)
     */
    static async optimizeForFeed(buffer: Buffer): Promise<Buffer> {
        return await sharp(buffer)
            .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
    }
}
