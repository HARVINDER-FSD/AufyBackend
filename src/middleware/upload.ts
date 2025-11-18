import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Create uploads directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'uploads');
const profileDir = path.join(uploadDir, 'profiles');
const postsDir = path.join(uploadDir, 'posts');
const storiesDir = path.join(uploadDir, 'stories');

// Ensure directories exist
[uploadDir, profileDir, postsDir, storiesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for different types of uploads
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Determine destination based on upload type
    const uploadType = req.path.includes('profile') ? 'profiles' : 
                       req.path.includes('stories') ? 'stories' : 'posts';
    
    const destination = path.join(uploadDir, uploadType);
    cb(null, destination);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Create unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to allow only images and videos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'));
  }
};

// Create multer upload instances
export const uploadProfile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for profile pictures
}).single('avatar');

export const uploadPost = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for post media
}).array('media', 10); // Allow up to 10 files per post

export const uploadStory = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit for stories
}).single('media');

// Middleware wrappers for Express
export const profileUpload = (req: Request, res: any, next: any) => {
  uploadProfile(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

export const postUpload = (req: Request, res: any, next: any) => {
  uploadPost(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

export const storyUpload = (req: Request, res: any, next: any) => {
  uploadStory(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

export default {
  profileUpload,
  postUpload,
  storyUpload
};