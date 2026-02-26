import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user';

// JWT secret key - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Interface for authenticated request
export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
}

// Middleware to verify JWT token
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Log token format for debugging (first/last 10 chars only)
    if (token.length < 20) {
      console.error('⚠️ Token too short:', token.length, 'chars');
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Attach user to request object
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    req.user = user;
    req.userId = decoded.userId;
    
    next();
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    console.error('Token format issue - client needs to clear cache and login again');
    return res.status(403).json({ 
      message: 'Invalid or expired token',
      hint: 'Please logout and login again to get a fresh token'
    });
  }
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
    
    if (!token) {
      // No token provided, continue without user
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Find user by ID
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user) {
      // Attach user to request object if found
      req.user = user;
      req.userId = decoded.userId;
    }
    
    next();
  } catch (error) {
    // Token invalid, but continue without user
    console.error('Optional auth error:', error);
    next();
  }
};

export default authenticateToken;