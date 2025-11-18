// lib/config.ts

// -------------------------
// Server-side config
// -------------------------
export const serverConfig = {
  database: {
    url: process.env.DATABASE_URL || "",
    maxConnections: Number.parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    ssl: process.env.NODE_ENV === "production",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    expiresIn: "7d",
    refreshExpiresIn: "30d",
  },

  security: {
    bcryptRounds: 10,
    passwordMinLength: 8,
  },

  blob: {
    token: process.env.BLOB_READ_WRITE_TOKEN || "", // optional
    baseUrl: process.env.BLOB_BASE_URL || "https://blob.vercel-storage.com",
  },

  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    keyPrefix: "social_media:",
    ttl: {
      user: 3600, // 1 hour
      session: 604800, // 7 days
      post: 1800, // 30 minutes
      feed: 300, // 5 minutes
    },
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later",
  },

  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedVideoTypes: ["video/mp4", "video/webm", "video/quicktime"],
  },

  ml: {
    moderationApiUrl:
      process.env.MODERATION_API_URL || "https://api.openai.com/v1/moderations",
    recommendationApiUrl: process.env.RECOMMENDATION_API_URL,
    apiKey: process.env.OPENAI_API_KEY || "",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    defaultFolder: process.env.CLOUDINARY_DEFAULT_FOLDER || "uploads",
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "profilePicsUnsigned",
  },

  websocket: {
    port: Number.parseInt(process.env.WS_PORT || "3001"),
  },
}

// Legacy export for backward compatibility
export const config = serverConfig;

// -------------------------
// Client-side safe config
// -------------------------
// Only include variables prefixed with NEXT_PUBLIC_
export const clientConfig = {
  cloudinary: {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "",
  },
}
