import { v2 as cloudinary } from "cloudinary"
import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import { config } from "./config"
import { errors, file } from "./utils"

// Configure Cloudinary using env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dcm470yhl",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export class StorageService {
  // Upload a single file to Cloudinary
  static async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    folder: "posts" | "stories" | "reels" | "avatars" | "messages" = "posts",
  ): Promise<{ url: string; publicId: string }> {
    // Validate type
    if (!file.isImage(mimeType) && !file.isVideo(mimeType)) {
      throw errors.badRequest("Invalid file type. Only images and videos are allowed.")
    }

    // Validate size
    const maxSize = config.upload.maxFileSize
    if (fileBuffer.length > maxSize) {
      throw errors.badRequest(`File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB`)
    }

    const extension = file.getExtension(fileName)
    const publicId = `${folder}/${userId}/${uuidv4()}.${extension}`.replace(/\.[^/.]+$/, "")

    try {
      const result: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "auto", public_id: publicId },
          (error, result) => (error ? reject(error) : resolve(result))
        )
        stream.end(fileBuffer)
      })

      return { url: result.secure_url, publicId: result.public_id }
    } catch (error) {
      console.error("Cloudinary upload error:", error)
      throw errors.internal("Failed to upload file to Cloudinary")
    }
  }

  // Upload multiple files
  static async uploadMultipleFiles(
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
    userId: string,
    folder: "posts" | "stories" | "reels" | "avatars" | "messages" = "posts",
  ): Promise<Array<{ url: string; publicId: string }>> {
    if (files.length > 10) throw errors.badRequest("Max 10 files per upload")
    return Promise.all(files.map((f) => this.uploadFile(f.buffer, f.originalname, f.mimetype, userId, folder)))
  }

  // Delete a single file
  static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "auto" })
    } catch (error) {
      console.error("Cloudinary delete error:", error)
      throw errors.internal("Failed to delete file")
    }
  }

  // Delete multiple files
  static async deleteMultipleFiles(publicIds: string[]): Promise<void> {
    if (!publicIds.length) return
    try {
      await cloudinary.api.delete_resources(publicIds, { resource_type: "auto" })
    } catch (error) {
      console.error("Cloudinary bulk delete error:", error)
      throw errors.internal("Failed to delete files")
    }
  }

  // Generate a video thumbnail (first frame)
  static generateVideoThumbnail(url: string, width = 300, height = 200): string {
    return url.replace("/upload/", `/upload/c_fill,w_${width},h_${height},f_jpg/`)
  }

  // Optimize image/video URL
  static getOptimizedUrl(url: string, width?: number, height?: number, crop: string = "fill", format: string = "auto"): string {
    if (!url.includes("cloudinary.com")) return url
    const transformations = [`c_${crop}`, `f_${format}`]
    if (width) transformations.push(`w_${width}`)
    if (height) transformations.push(`h_${height}`)
    return url.replace("/upload/", `/upload/${transformations.join(",")}/`)
  }
}

// Multer configuration for direct file upload
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [...config.upload.allowedImageTypes, ...config.upload.allowedVideoTypes]
    if (!allowedTypes.includes(file.mimetype)) return cb(new Error("Invalid file type"))
    cb(null, true)
  },
})

// Middleware shortcuts
export const uploadSingle = uploadMiddleware.single("file")
export const uploadMultiple = uploadMiddleware.array("files", 10)
export const uploadAvatar = uploadMiddleware.single("avatar")
export const uploadStory = uploadMiddleware.single("story")
export const uploadReel = uploadMiddleware.single("reel")
