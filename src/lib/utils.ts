import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { serverConfig as config } from "../lib/config"
import type { JWTPayload } from "./types"

// Password utilities
export const password = {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, config.security.bcryptRounds)
  },

  async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword)
  },
}

// JWT utilities
export const token = {
  sign(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    })
  },

  verify(token: string): JWTPayload {
    return jwt.verify(token, config.jwt.secret) as JWTPayload
  },

  decode(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload
    } catch {
      return null
    }
  },
}

// Validation utilities
export const validate = {
  email(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  username(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
    return usernameRegex.test(username)
  },

  password(password: string): boolean {
    return password.length >= config.security.passwordMinLength
  },

  uuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  },
}

// Pagination utilities
export const pagination = {
  getOffset(page: number, limit: number): number {
    return (page - 1) * limit
  },

  getMetadata(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit)
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    }
  },

  validateParams(page?: string, limit?: string) {
    const pageNum = Math.max(1, Number.parseInt(page || "1"))
    const limitNum = Math.min(
      config.pagination.maxLimit,
      Math.max(1, Number.parseInt(limit || config.pagination.defaultLimit.toString())),
    )
    return { page: pageNum, limit: limitNum }
  },
}

// Error handling utilities
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public code?: string,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export const errors = {
  badRequest: (message: string) => new AppError(message, 400, "BAD_REQUEST"),
  unauthorized: (message = "Unauthorized") => new AppError(message, 401, "UNAUTHORIZED"),
  forbidden: (message = "Forbidden") => new AppError(message, 403, "FORBIDDEN"),
  notFound: (message = "Not found") => new AppError(message, 404, "NOT_FOUND"),
  conflict: (message: string) => new AppError(message, 409, "CONFLICT"),
  tooManyRequests: (message = "Too many requests") => new AppError(message, 429, "TOO_MANY_REQUESTS"),
  internal: (message = "Internal server error") => new AppError(message, 500, "INTERNAL_ERROR"),
}

// Sanitization utilities
export const sanitize = {
  html(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
  },

  username(username: string): string {
    return username.toLowerCase().trim()
  },

  email(email: string): string {
    return email.toLowerCase().trim()
  },
}

// Time utilities
export const time = {
  now(): Date {
    return new Date()
  },

  addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000)
  },

  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  },

  isExpired(date: Date): boolean {
    return date < new Date()
  },

  formatRelative(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return "just now"
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString()
  },
}

// File utilities
export const file = {
  getExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || ""
  },

  isImage(mimeType: string): boolean {
    return config.upload.allowedImageTypes.includes(mimeType)
  },

  isVideo(mimeType: string): boolean {
    return config.upload.allowedVideoTypes.includes(mimeType)
  },

  generateFilename(originalName: string, userId: string): string {
    const extension = this.getExtension(originalName)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2)
    return `${userId}/${timestamp}_${random}.${extension}`
  },
}

// Cache key generators
export const cacheKeys = {
  user: (id: string) => `${config.redis.keyPrefix}user:${id}`,
  userByUsername: (username: string) => `${config.redis.keyPrefix}user:username:${username}`,
  userByEmail: (email: string) => `${config.redis.keyPrefix}user:email:${email}`,
  post: (id: string) => `${config.redis.keyPrefix}post:${id}`,
  postLikes: (id: string) => `${config.redis.keyPrefix}post:${id}:likes`,
  postComments: (id: string) => `${config.redis.keyPrefix}post:${id}:comments`,
  userFeed: (id: string) => `${config.redis.keyPrefix}feed:${id}`,
  userStories: (id: string) => `${config.redis.keyPrefix}stories:${id}`,
  conversation: (id: string) => `${config.redis.keyPrefix}conversation:${id}`,
  userFollowers: (id: string) => `${config.redis.keyPrefix}followers:${id}`,
  userFollowing: (id: string) => `${config.redis.keyPrefix}following:${id}`,
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}