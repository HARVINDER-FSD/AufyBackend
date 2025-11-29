import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data
 */
export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.substring(0, 32)),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt sensitive data
 */
export const decrypt = (text: string): string => {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = parts.join(':');
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.substring(0, 32)),
    iv
  );
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Hash sensitive data (one-way)
 */
export const hash = (text: string): string => {
  return crypto
    .createHash('sha256')
    .update(text + process.env.JWT_SECRET)
    .digest('hex');
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate HMAC signature
 */
export const generateSignature = (data: string, secret: string): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
};

/**
 * Verify HMAC signature
 */
export const verifySignature = (data: string, signature: string, secret: string): boolean => {
  const expectedSignature = generateSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Generate secure password reset token
 */
export const generatePasswordResetToken = (): { token: string; hash: string; expires: Date } => {
  const token = generateSecureToken(32);
  const tokenHash = hash(token);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  return { token, hash: tokenHash, expires };
};

/**
 * Mask sensitive data for logging
 */
export const maskSensitiveData = (data: any): any => {
  if (typeof data === 'string') {
    if (data.length > 4) {
      return data.substring(0, 2) + '***' + data.substring(data.length - 2);
    }
    return '***';
  }
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  
  if (data && typeof data === 'object') {
    const masked: any = {};
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];
    
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          masked[key] = '***REDACTED***';
        } else {
          masked[key] = maskSensitiveData(data[key]);
        }
      }
    }
    return masked;
  }
  
  return data;
};
