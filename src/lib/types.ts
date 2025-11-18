// Core type definitions for the social media backend

export interface User {
  id: string
  username: string
  email: string
  full_name?: string
  bio?: string
  avatar_url?: string
  phone?: string
  is_verified: boolean
  is_private: boolean
  is_active: boolean
  last_seen?: Date
  created_at: Date
  updated_at: Date
}

export interface Post {
  id: string
  user_id: string
  content?: string
  media_urls?: string[]
  media_type?: "image" | "video" | "carousel"
  location?: string
  is_archived: boolean
  created_at: Date
  updated_at: Date
  user?: User
  likes_count?: number
  comments_count?: number
  is_liked?: boolean
}

export interface Comment {
  id: string
  user_id: string
  post_id: string
  parent_comment_id?: string
  content: string
  is_deleted: boolean
  created_at: Date
  updated_at: Date
  user?: User
  replies?: Comment[]
}

export interface Story {
  id: string
  user_id: string
  media_url: string
  media_type: "image" | "video"
  content?: string
  expires_at: Date
  is_archived: boolean
  created_at: Date
  user?: User
  is_viewed?: boolean
}

export interface Reel {
  id: string
  user_id: string
  video_url: string
  thumbnail_url?: string
  title?: string
  description?: string
  duration?: number
  view_count: number
  is_public: boolean
  created_at: Date
  updated_at: Date
  user?: User
  likes_count?: number
  comments_count?: number
  is_liked?: boolean
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  status: "active" | "pending" | "blocked"
  created_at: Date
}

export interface Conversation {
  id: string
  type: "direct" | "group"
  name?: string
  created_by?: string
  created_at: Date
  updated_at: Date
  participants?: User[]
  last_message?: Message
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content?: string
  media_url?: string
  media_type?: string
  message_type: "text" | "image" | "video" | "audio" | "file"
  reply_to_id?: string
  is_deleted: boolean
  created_at: Date
  updated_at: Date
  sender?: User
  reply_to?: Message
  is_read?: boolean
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  content?: string
  data?: any
  is_read: boolean
  created_at: Date
}

export interface Report {
  id: string
  reporter_id: string
  reported_user_id?: string
  reported_post_id?: string
  reported_comment_id?: string
  reason: string
  description?: string
  status: "pending" | "reviewed" | "resolved" | "dismissed"
  created_at: Date
  updated_at: Date
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Request types
export interface CreatePostRequest {
  content?: string
  media_urls?: string[]
  media_type?: "image" | "video" | "carousel"
  location?: string
}

export interface CreateCommentRequest {
  content: string
  parent_comment_id?: string
}

export interface CreateStoryRequest {
  media_url: string
  media_type: "image" | "video"
  content?: string
}

export interface CreateReelRequest {
  video_url: string
  thumbnail_url?: string
  title?: string
  description?: string
  duration?: number
}

export interface SendMessageRequest {
  content?: string
  media_url?: string
  media_type?: string
  message_type: "text" | "image" | "video" | "audio" | "file"
  reply_to_id?: string
}

// JWT Payload
export interface JWTPayload {
  userId: string
  username: string
  email: string
  iat: number
  exp: number
}

// WebSocket message types
export interface WebSocketMessage {
  type: "message" | "typing" | "read_receipt" | "notification" | "user_status"
  data: any
  timestamp: Date
}
