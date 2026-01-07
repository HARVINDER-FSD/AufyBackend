"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadReel = exports.uploadStory = exports.uploadAvatar = exports.uploadMultiple = exports.uploadSingle = exports.uploadMiddleware = exports.StorageService = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const config_1 = require("./config");
const utils_1 = require("./utils");
// Configure Cloudinary using env variables
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dcm470yhl",
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
class StorageService {
    // Upload a single file to Cloudinary
    static async uploadFile(fileBuffer, fileName, mimeType, userId, folder = "posts") {
        // Validate type
        if (!utils_1.file.isImage(mimeType) && !utils_1.file.isVideo(mimeType)) {
            throw utils_1.errors.badRequest("Invalid file type. Only images and videos are allowed.");
        }
        // Validate size
        const maxSize = utils_1.file.isImage(mimeType) ? config_1.config.upload.maxImageSize : config_1.config.upload.maxVideoSize;
        if (fileBuffer.length > maxSize) {
            throw utils_1.errors.badRequest(`File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB`);
        }
        const extension = utils_1.file.getExtension(fileName);
        const publicId = `${folder}/${userId}/${(0, uuid_1.v4)()}.${extension}`.replace(/\.[^/.]+$/, "");
        try {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: "auto", public_id: publicId }, (error, result) => (error ? reject(error) : resolve(result)));
                stream.end(fileBuffer);
            });
            return { url: result.secure_url, publicId: result.public_id };
        }
        catch (error) {
            console.error("Cloudinary upload error:", error);
            throw utils_1.errors.internal("Failed to upload file to Cloudinary");
        }
    }
    // Upload multiple files
    static async uploadMultipleFiles(files, userId, folder = "posts") {
        if (files.length > 10)
            throw utils_1.errors.badRequest("Max 10 files per upload");
        return Promise.all(files.map((f) => this.uploadFile(f.buffer, f.originalname, f.mimetype, userId, folder)));
    }
    // Delete a single file
    static async deleteFile(publicId) {
        try {
            await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: "auto" });
        }
        catch (error) {
            console.error("Cloudinary delete error:", error);
            throw utils_1.errors.internal("Failed to delete file");
        }
    }
    // Delete multiple files
    static async deleteMultipleFiles(publicIds) {
        if (!publicIds.length)
            return;
        try {
            await cloudinary_1.v2.api.delete_resources(publicIds, { resource_type: "auto" });
        }
        catch (error) {
            console.error("Cloudinary bulk delete error:", error);
            throw utils_1.errors.internal("Failed to delete files");
        }
    }
    // Generate a video thumbnail (first frame)
    static generateVideoThumbnail(url, width = 300, height = 200) {
        return url.replace("/upload/", `/upload/c_fill,w_${width},h_${height},f_jpg/`);
    }
    // Optimize image/video URL
    static getOptimizedUrl(url, width, height, crop = "fill", format = "auto") {
        if (!url.includes("cloudinary.com"))
            return url;
        const transformations = [`c_${crop}`, `f_${format}`];
        if (width)
            transformations.push(`w_${width}`);
        if (height)
            transformations.push(`h_${height}`);
        return url.replace("/upload/", `/upload/${transformations.join(",")}/`);
    }
}
exports.StorageService = StorageService;
// Multer configuration for direct file upload
exports.uploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: config_1.config.upload.maxFileSize, files: 10 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [...config_1.config.upload.allowedImageTypes, ...config_1.config.upload.allowedVideoTypes];
        if (!allowedTypes.includes(file.mimetype))
            return cb(new Error("Invalid file type"));
        cb(null, true);
    },
});
// Middleware shortcuts
exports.uploadSingle = exports.uploadMiddleware.single("file");
exports.uploadMultiple = exports.uploadMiddleware.array("files", 10);
exports.uploadAvatar = exports.uploadMiddleware.single("avatar");
exports.uploadStory = exports.uploadMiddleware.single("story");
exports.uploadReel = exports.uploadMiddleware.single("reel");
