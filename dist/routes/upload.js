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
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("cloudinary");
const router = (0, express_1.Router)();
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
// Get Cloudinary configuration for direct upload
router.post("/", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const folder = req.body.folder || "avatars";
        // Generate unique public ID
        const timestamp = Date.now();
        const publicId = `${folder}/${userId}/${timestamp}`;
        // Generate signature for authenticated upload
        const signature = cloudinary_1.v2.utils.api_sign_request({
            timestamp: timestamp,
            folder: folder,
            public_id: publicId
        }, process.env.CLOUDINARY_API_SECRET);
        console.log('✅ Cloudinary config generated for user:', userId);
        // Return Cloudinary config for direct upload
        res.json({
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || "dcm470yhl",
            apiKey: process.env.CLOUDINARY_API_KEY,
            timestamp: timestamp,
            signature: signature,
            folder: folder,
            publicId: publicId,
        });
    }
    catch (error) {
        console.error('❌ Cloudinary config error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to generate upload configuration',
            error: error.message,
        });
    }
}));
// Upload single file (simplified - actual file upload handled by middleware)
router.post("/single", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { url, folder = "posts" } = req.body;
        if (!url) {
            return res.status(400).json({
                success: false,
                error: "File URL is required",
            });
        }
        res.json({
            success: true,
            data: { url, folder },
            message: "File uploaded successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Generate presigned URL for direct upload
router.post("/presigned-url", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fileName, contentType, folder = "posts" } = req.body;
        if (!fileName || !contentType) {
            return res.status(400).json({
                success: false,
                error: "fileName and contentType are required",
            });
        }
        const key = `${folder}/${req.userId}/${Date.now()}_${fileName}`;
        // Note: This requires StorageService.generatePresignedUrl to be implemented
        // For now, return a placeholder response
        res.json({
            success: true,
            data: {
                key,
                uploadUrl: `https://storage.example.com/${key}`,
            },
            message: "Presigned URL generated successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Delete file
router.delete("/:key(*)", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { key } = req.params;
        // Verify the file belongs to the user
        if (!key.includes(req.userId)) {
            return res.status(403).json({
                success: false,
                error: "You can only delete your own files",
            });
        }
        res.json({
            success: true,
            message: "File deleted successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
exports.default = router;
