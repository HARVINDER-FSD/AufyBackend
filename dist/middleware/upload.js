"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyUpload = exports.postUpload = exports.profileUpload = exports.uploadStory = exports.uploadPost = exports.uploadProfile = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Create uploads directory if it doesn't exist
const uploadDir = path_1.default.join(process.cwd(), 'uploads');
const profileDir = path_1.default.join(uploadDir, 'profiles');
const postsDir = path_1.default.join(uploadDir, 'posts');
const storiesDir = path_1.default.join(uploadDir, 'stories');
// Ensure directories exist
[uploadDir, profileDir, postsDir, storiesDir].forEach(dir => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
});
// Configure storage for different types of uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Determine destination based on upload type
        const uploadType = req.path.includes('profile') ? 'profiles' :
            req.path.includes('stories') ? 'stories' : 'posts';
        const destination = path_1.default.join(uploadDir, uploadType);
        cb(null, destination);
    },
    filename: (req, file, cb) => {
        // Create unique filename with timestamp and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
// File filter to allow only images and videos
const fileFilter = (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    }
    else {
        cb(new Error('Only images and videos are allowed'));
    }
};
// Create multer upload instances
exports.uploadProfile = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for profile pictures
}).single('avatar');
exports.uploadPost = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for post media
}).array('media', 10); // Allow up to 10 files per post
exports.uploadStory = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit for stories
}).single('media');
// Middleware wrappers for Express
const profileUpload = (req, res, next) => {
    (0, exports.uploadProfile)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};
exports.profileUpload = profileUpload;
const postUpload = (req, res, next) => {
    (0, exports.uploadPost)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};
exports.postUpload = postUpload;
const storyUpload = (req, res, next) => {
    (0, exports.uploadStory)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};
exports.storyUpload = storyUpload;
exports.default = {
    profileUpload: exports.profileUpload,
    postUpload: exports.postUpload,
    storyUpload: exports.storyUpload
};
