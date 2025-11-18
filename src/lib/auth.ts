import type { Request, Response, NextFunction } from "express"
import { query, cache, redis } from "./database"
import { token, password, validate, errors, sanitize } from "./utils"
import { config } from "./config"
import type { User, JWTPayload } from "./types"
import { NextRequest } from "next/server"
import * as bcrypt from 'bcryptjs'
import * as jsonwebtoken from 'jsonwebtoken'

// Initialize MongoDB connection
import mongoose from 'mongoose';
import User from '../models/user';

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia');
      console.log('Connected to MongoDB');
      
      // Check if we have any users, if not create a default one
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const hashedPassword = bcrypt.hashSync("password123", 10);
        
        await User.create({
          username: "testuser",
          email: "test@example.com",
          password: hashedPassword,
          full_name: "Test User",
          date_of_birth: new Date("1990-01-01"),
          avatar_url: "/placeholder-user.jpg",
          is_verified: true,
          is_private: false,
          is_active: true,
          last_seen: new Date(),
          bio: "This is a test user bio"
        });
        
        console.log('Created default user');
      }
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Initialize database connection
connectToMongoDB();

// Verify authentication from Next.js API route
export async function verifyAuth(req: NextRequest) {
  try {
    // Prefer Authorization header, then cookies (`client-token` or `token`)
    let accessToken: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      accessToken = authHeader.split(' ')[1];
    }

    if (!accessToken) {
      const cookieHeader = req.headers.get('cookie') || '';
      const cookieMap = Object.fromEntries(
        cookieHeader.split(';').map(p => p.trim()).filter(Boolean).map(p => {
          const idx = p.indexOf('=');
          return [p.substring(0, idx), decodeURIComponent(p.substring(idx + 1))];
        })
      );
      accessToken = (cookieMap['client-token'] || cookieMap['token']) ?? null;
    }

    if (!accessToken) {
      return { success: false, message: 'No token provided' };
    }

    // Verify with either app JWT secret (used by /api/auth/login) or with utils.token
    let decoded: any = null;
    const envSecret = process.env.JWT_SECRET;
    try {
      if (envSecret) {
        decoded = jsonwebtoken.verify(accessToken, envSecret);
      }
    } catch {}

    if (!decoded) {
      try {
        decoded = token.verify(accessToken);
      } catch {}
    }

    if (!decoded || !decoded.userId) {
      return { success: false, message: 'Invalid token' };
    }

    // If Redis is unavailable, or key is missing, don't hard-fail in local/dev
    try {
      if (redis) {
        const exists = await redis.exists(`session:${decoded.userId}:${accessToken}`);
        if (!exists) {
          // Soft-warn but allow; many flows set cookies without Redis enabled
          console.warn('Session key not found in Redis; allowing based on JWT');
        }
      }
    } catch (e) {
      console.warn('Redis check failed; allowing based on JWT');
    }

    return {
      success: true,
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return { success: false, message: error.message || 'Authentication failed' };
  }
}

// Authentication service
export class AuthService {
  // Register new user
  static async register(userData: {
    username: string
    email: string
    password: string
    full_name?: string
  }) {
    const { username, email, password: plainPassword, full_name = "" } = userData

    // Validate input
    if (!username || !email || !plainPassword) {
      throw errors.badRequest("Username, email and password are required")
    }

    // Sanitize input
    const sanitizedUsername = sanitize.username(username)
    const sanitizedEmail = sanitize.email(email)
    
    try {
      // Use in-memory user storage
      const users = global.users || [];
      
      // Check if username or email already exists
      const existingUser = users.find(u => 
        u.username.toLowerCase() === sanitizedUsername.toLowerCase() || 
        u.email.toLowerCase() === sanitizedEmail.toLowerCase()
      );

      if (existingUser) {
        throw errors.conflict("Username or email already exists")
      }

      // Create new user with simple ID generation and hash the password
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);
      
      const newUser = {
        id: `user-${Date.now()}`,
        username: sanitizedUsername,
        email: sanitizedEmail,
        password_hash: hashedPassword,
        full_name: full_name,
        avatar_url: "/placeholder-user.jpg",
        is_verified: false,
        is_private: false,
        is_active: true,
        last_seen: new Date().toISOString(),
        bio: ""
      };
      
      // Add to users array
      users.push(newUser);
      global.users = users;
      
      // Save to localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('users', JSON.stringify(global.users));
      }

      // Generate JWT token
      const accessToken = token.sign({
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
      })

      return {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          full_name: newUser.full_name,
          avatar_url: newUser.avatar_url,
          is_verified: newUser.is_verified,
          is_private: newUser.is_private,
          bio: newUser.bio
        },
        accessToken,
      }
    } catch (error) {
      console.error("Registration error:", error)
      throw error
    }
  }

  // Login user
  static async login(credentials: { username: string; password: string }, deviceInfo?: any) {
    const { username, password: plainPassword } = credentials

    // Sanitize input
    const sanitizedUsername = sanitize.username(username)
    let user;

    try {
      // Use in-memory user storage for demonstration
      const users = global.users || [];
      
      // Find user by username or email
      const foundUser = users.find(u => 
        u.username.toLowerCase() === sanitizedUsername.toLowerCase() || 
        u.email.toLowerCase() === sanitizedUsername.toLowerCase()
      );
      
      if (!foundUser) {
        throw errors.unauthorized("Invalid credentials");
      }
      
      user = foundUser;
    } catch (error) {
      console.error("Login error:", error);
      throw errors.unauthorized("Authentication failed");
    }

    // Check password using bcrypt
    const isValidPassword = bcrypt.compareSync(plainPassword, user.password_hash);
    
    if (!isValidPassword) {
      throw errors.unauthorized("Authentication failed");
    }

    // Update last seen - skip for in-memory implementation
    // await query("UPDATE users SET last_seen = NOW() WHERE id = $1", [user.id])

    // Generate JWT token
    const accessToken = token.sign({
      userId: user.id,
      username: user.username,
      email: user.email,
    })

    // Store session in Redis if available
    try {
      await this.createSession(user.id, accessToken, deviceInfo)
    } catch (error) {
      console.warn("Session storage failed, continuing without session persistence:", error);
      // Continue without session persistence
    }

    // Cache user data if Redis is available
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_private: user.is_private,
      last_seen: user.last_seen,
    }
    
    try {
      if (redis) {
        await cache.set(`user:${user.id}`, userData, config.redis.ttl.user)
      }
    } catch (error) {
      console.warn("User caching failed, continuing without cache:", error);
      // Continue without caching
    }

    return {
      user: userData,
      accessToken,
    }
  }

  // Create session
  private static async createSession(userId: string, accessToken: string, deviceInfo?: any) {
    // Store in Redis for quick access if available
    if (redis) {
      try {
        await redis.set(`session:${userId}:${accessToken}`, JSON.stringify({
          userId,
          deviceInfo,
          createdAt: new Date().toISOString()
        }), 'EX', config.redis.ttl.session);
      } catch (error) {
        console.warn("Failed to cache session in Redis:", error);
        // Continue without Redis caching
      }
    }
  }
}
