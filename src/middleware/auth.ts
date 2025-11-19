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
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Just attach the userId from token - don't verify user exists here
    // Let individual routes handle user lookup with proper ID format handling
    req.user = { userId: decoded.userId };
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
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