import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../lib/rate-limiter';
import rateLimit from 'express-rate-limit';

// Interface for Request with optional userId (from auth middleware)
interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Factory to create Redis-backed Rate Limiters
 * @param action Name of the action (e.g., 'login', 'post')
 * @param limit Max allowed requests
 * @param windowSeconds Time window in seconds
 */
export const createRateLimiter = (action: string, limit: number, windowSeconds: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Identify user: Prefer userId (if authenticated), fallback to IP
    // This allows "User-based" limits as requested
    const key = req.userId || req.ip || 'unknown';
    
    const result = await RateLimiter.consume(key, action, limit, windowSeconds);

    // Standard RateLimit Headers
    res.set('X-RateLimit-Limit', limit.toString());
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    res.set('X-RateLimit-Reset', Math.ceil(result.reset / 1000).toString());

    if (!result.success) {
      return res.status(429).json({
        success: false,
        message: `Too many ${action} requests. Please try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`
      });
    }

    next();
  };
};

// --- Specific Action Limiters ---

// 1. Auth Limiter (Login/Register) - Very Strict
// 10 attempts per 15 mins
export const authLimiter = createRateLimiter('auth', 10, 15 * 60);

// 2. Post Creation - Prevent Spam
// 5 posts per minute
export const postCreationLimiter = createRateLimiter('post_create', 5, 60);

// 3. Like/Reaction - Prevent Bot/Click Spam
// 100 likes per minute (Generous for humans, strict for bots)
export const likeLimiter = createRateLimiter('like', 100, 60);

// 4. Comment Limiter
// 15 comments per minute
export const commentLimiter = createRateLimiter('comment', 15, 60);

// 5. Follow Limiter - Prevent Growth Hacking
// 500 follows per day (24 hours)
export const followLimiter = createRateLimiter('follow', 500, 24 * 60 * 60);

// 6. Message Limiter - Prevent Chat Spam
// 30 messages per minute
export const messageLimiter = createRateLimiter('message', 30, 60);

// --- Global Fallback Limiter (IP Based) ---
// Uses memory (or could be configured for Redis) for basic DDOS protection
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Increased global limit since we have granular limits
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
