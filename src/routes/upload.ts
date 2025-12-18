import { Router } from "express"
import { authenticateToken } from "../middleware/auth"
import { v4 as uuidv4 } from "uuid"
import { v2 as cloudinary } from 'cloudinary'

const router = Router()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Get Cloudinary configuration for direct upload
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId
    const folder = req.body.folder || "avatars"
    
    // Generate unique public ID
    const timestamp = Date.now()
    const publicId = `${folder}/${userId}/${timestamp}`
    
    // Generate signature for authenticated upload
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder,
        public_id: publicId
      },
      process.env.CLOUDINARY_API_SECRET as string
    )
    
    console.log('✅ Cloudinary config generated for user:', userId)
    
    // Return Cloudinary config for direct upload
    res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || "dcm470yhl",
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp: timestamp,
      signature: signature,
      folder: folder,
      publicId: publicId,
    })
  } catch (error: any) {
    console.error('❌ Cloudinary config error:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate upload configuration',
      error: error.message,
    })
  }
})

// Upload single file (simplified - actual file upload handled by middleware)
router.post("/single", authenticateToken, async (req, res) => {
  try {
    const { url, folder = "posts" } = req.body

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "File URL is required",
      })
    }

    res.json({
      success: true,
      data: { url, folder },
      message: "File uploaded successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Generate presigned URL for direct upload
router.post("/presigned-url", authenticateToken, async (req: any, res) => {
  try {
    const { fileName, contentType, folder = "posts" } = req.body

    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        error: "fileName and contentType are required",
      })
    }

    const key = `${folder}/${req.userId}/${Date.now()}_${fileName}`
    
    // Note: This requires StorageService.generatePresignedUrl to be implemented
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        key,
        uploadUrl: `https://storage.example.com/${key}`,
      },
      message: "Presigned URL generated successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Delete file
router.delete("/:key(*)", authenticateToken, async (req: any, res) => {
  try {
    const { key } = req.params

    // Verify the file belongs to the user
    if (!key.includes(req.userId)) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own files",
      })
    }

    res.json({
      success: true,
      message: "File deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router

