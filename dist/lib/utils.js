"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = exports.file = exports.time = exports.sanitize = exports.errors = exports.AppError = exports.pagination = exports.validate = exports.token = exports.password = void 0;
exports.cn = cn;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../lib/config");
// Password utilities
exports.password = {
    async hash(plainPassword) {
        return bcryptjs_1.default.hash(plainPassword, config_1.serverConfig.security.bcryptRounds);
    },
    async verify(plainPassword, hashedPassword) {
        return bcryptjs_1.default.compare(plainPassword, hashedPassword);
    },
};
// JWT utilities
exports.token = {
    sign(payload) {
        return jsonwebtoken_1.default.sign(payload, config_1.serverConfig.jwt.secret, {
            expiresIn: config_1.serverConfig.jwt.expiresIn,
        });
    },
    verify(token) {
        return jsonwebtoken_1.default.verify(token, config_1.serverConfig.jwt.secret);
    },
    decode(token) {
        try {
            return jsonwebtoken_1.default.decode(token);
        }
        catch {
            return null;
        }
    },
};
// Validation utilities
exports.validate = {
    email(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    username(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        return usernameRegex.test(username);
    },
    password(password) {
        return password.length >= config_1.serverConfig.security.passwordMinLength;
    },
    uuid(id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    },
};
// Pagination utilities
exports.pagination = {
    getOffset(page, limit) {
        return (page - 1) * limit;
    },
    getMetadata(page, limit, total) {
        const totalPages = Math.ceil(total / limit);
        return {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };
    },
    validateParams(page, limit) {
        const pageNum = Math.max(1, Number.parseInt(page || "1"));
        const limitNum = Math.min(config_1.serverConfig.pagination.maxLimit, Math.max(1, Number.parseInt(limit || config_1.serverConfig.pagination.defaultLimit.toString())));
        return { page: pageNum, limit: limitNum };
    },
};
// Error handling utilities
class AppError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
exports.errors = {
    badRequest: (message) => new AppError(message, 400, "BAD_REQUEST"),
    unauthorized: (message = "Unauthorized") => new AppError(message, 401, "UNAUTHORIZED"),
    forbidden: (message = "Forbidden") => new AppError(message, 403, "FORBIDDEN"),
    notFound: (message = "Not found") => new AppError(message, 404, "NOT_FOUND"),
    conflict: (message) => new AppError(message, 409, "CONFLICT"),
    tooManyRequests: (message = "Too many requests") => new AppError(message, 429, "TOO_MANY_REQUESTS"),
    internal: (message = "Internal server error") => new AppError(message, 500, "INTERNAL_ERROR"),
};
// Sanitization utilities
exports.sanitize = {
    html(input) {
        return input
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
    },
    username(username) {
        return username.toLowerCase().trim();
    },
    email(email) {
        return email.toLowerCase().trim();
    },
};
// Time utilities
exports.time = {
    now() {
        return new Date();
    },
    addHours(date, hours) {
        return new Date(date.getTime() + hours * 60 * 60 * 1000);
    },
    addDays(date, days) {
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    },
    isExpired(date) {
        return date < new Date();
    },
    formatRelative(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (seconds < 60)
            return "just now";
        if (minutes < 60)
            return `${minutes}m`;
        if (hours < 24)
            return `${hours}h`;
        if (days < 7)
            return `${days}d`;
        return date.toLocaleDateString();
    },
};
// File utilities
exports.file = {
    getExtension(filename) {
        return filename.split(".").pop()?.toLowerCase() || "";
    },
    isImage(mimeType) {
        return config_1.serverConfig.upload.allowedImageTypes.includes(mimeType);
    },
    isVideo(mimeType) {
        return config_1.serverConfig.upload.allowedVideoTypes.includes(mimeType);
    },
    generateFilename(originalName, userId) {
        const extension = this.getExtension(originalName);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        return `${userId}/${timestamp}_${random}.${extension}`;
    },
};
// Cache key generators
exports.cacheKeys = {
    user: (id) => `${config_1.serverConfig.redis.keyPrefix}user:${id}`,
    userByUsername: (username) => `${config_1.serverConfig.redis.keyPrefix}user:username:${username}`,
    userByEmail: (email) => `${config_1.serverConfig.redis.keyPrefix}user:email:${email}`,
    post: (id) => `${config_1.serverConfig.redis.keyPrefix}post:${id}`,
    postLikes: (id) => `${config_1.serverConfig.redis.keyPrefix}post:${id}:likes`,
    postComments: (id) => `${config_1.serverConfig.redis.keyPrefix}post:${id}:comments`,
    userFeed: (id) => `${config_1.serverConfig.redis.keyPrefix}feed:${id}`,
    userStories: (id) => `${config_1.serverConfig.redis.keyPrefix}stories:${id}`,
    conversation: (id) => `${config_1.serverConfig.redis.keyPrefix}conversation:${id}`,
    userFollowers: (id) => `${config_1.serverConfig.redis.keyPrefix}followers:${id}`,
    userFollowing: (id) => `${config_1.serverConfig.redis.keyPrefix}following:${id}`,
};
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
