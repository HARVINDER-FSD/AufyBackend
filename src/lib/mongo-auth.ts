import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import User from '@/models/user';
import { ensureDbConnected } from './mongodb';

// MongoDB Auth Service (Real implementation)
export class MongoAuthService {
  // Register a new user
  static async register({ username, email, password, full_name }: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
  }) {
    try {
      // Ensure database is connected before proceeding
      await ensureDbConnected();

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        throw { status: 400, message: 'User already exists' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        full_name: full_name || username,
        is_verified: false,
        is_private: false,
        is_active: true,
        created_at: new Date(),
        avatar_url: null
      });

      // Generate JWT token
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'fallback-secret-key-for-development',
        { expiresIn: '7d' }
      );

      // Return user data
      return {
        user,
        accessToken
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login user
  static async login({ email, password }: { email: string; password: string }) {
    try {
      // Ensure database is connected before proceeding
      await ensureDbConnected();

      // Find user by email
      const user = await User.findOne({ email });

      if (!user) {
        throw { status: 401, message: 'Invalid credentials' };
      }

      // Compare passwords
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw { status: 401, message: 'Invalid credentials' };
      }

      // Generate JWT token
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'fallback-secret-key-for-development',
        { expiresIn: '7d' }
      );

      // Return user data
      return {
        user,
        accessToken
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Get user by ID
  static async getUserById(userId: string) {
    try {
      // Ensure database is connected before proceeding
      await ensureDbConnected();

      // Find user by ID
      const user = await User.findById(userId);

      if (!user) {
        throw { status: 404, message: 'User not found' };
      }

      // Return user without password
      const { password, ...userWithoutPassword } = user.toObject();
      return userWithoutPassword;
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }
}