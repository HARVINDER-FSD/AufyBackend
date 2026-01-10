"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskSensitiveData = exports.generatePasswordResetToken = exports.verifySignature = exports.generateSignature = exports.generateSecureToken = exports.hash = exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto_1.default.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
/**
 * Encrypt sensitive data
 */
const encrypt = (text) => {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};
exports.encrypt = encrypt;
/**
 * Decrypt sensitive data
 */
const decrypt = (text) => {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
exports.decrypt = decrypt;
/**
 * Hash sensitive data (one-way)
 */
const hash = (text) => {
    return crypto_1.default
        .createHash('sha256')
        .update(text + process.env.JWT_SECRET)
        .digest('hex');
};
exports.hash = hash;
/**
 * Generate secure random token
 */
const generateSecureToken = (length = 32) => {
    return crypto_1.default.randomBytes(length).toString('hex');
};
exports.generateSecureToken = generateSecureToken;
/**
 * Generate HMAC signature
 */
const generateSignature = (data, secret) => {
    return crypto_1.default
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');
};
exports.generateSignature = generateSignature;
/**
 * Verify HMAC signature
 */
const verifySignature = (data, signature, secret) => {
    const expectedSignature = (0, exports.generateSignature)(data, secret);
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};
exports.verifySignature = verifySignature;
/**
 * Generate secure password reset token
 */
const generatePasswordResetToken = () => {
    const token = (0, exports.generateSecureToken)(32);
    const tokenHash = (0, exports.hash)(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return { token, hash: tokenHash, expires };
};
exports.generatePasswordResetToken = generatePasswordResetToken;
/**
 * Mask sensitive data for logging
 */
const maskSensitiveData = (data) => {
    if (typeof data === 'string') {
        if (data.length > 4) {
            return data.substring(0, 2) + '***' + data.substring(data.length - 2);
        }
        return '***';
    }
    if (Array.isArray(data)) {
        return data.map(exports.maskSensitiveData);
    }
    if (data && typeof data === 'object') {
        const masked = {};
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    masked[key] = '***REDACTED***';
                }
                else {
                    masked[key] = (0, exports.maskSensitiveData)(data[key]);
                }
            }
        }
        return masked;
    }
    return data;
};
exports.maskSensitiveData = maskSensitiveData;
