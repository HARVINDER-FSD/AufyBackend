"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoAuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_1 = __importDefault(require("@/models/user"));
const mongodb_1 = require("./mongodb");
// MongoDB Auth Service (Real implementation)
class MongoAuthService {
    // Register a new user
    static async register({ username, email, password, full_name }) {
        try {
            // Ensure database is connected before proceeding
            await (0, mongodb_1.ensureDbConnected)();
            // Check if user already exists
            const existingUser = await user_1.default.findOne({
                $or: [{ email }, { username }]
            });
            if (existingUser) {
                throw { status: 400, message: 'User already exists' };
            }
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            // Create new user
            const user = await user_1.default.create({
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
            const accessToken = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret-key-for-development', { expiresIn: '7d' });
            // Return user data
            return {
                user,
                accessToken
            };
        }
        catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
    // Login user
    static async login({ email, password }) {
        try {
            // Ensure database is connected before proceeding
            await (0, mongodb_1.ensureDbConnected)();
            // Find user by email
            const user = await user_1.default.findOne({ email });
            if (!user) {
                throw { status: 401, message: 'Invalid credentials' };
            }
            // Compare passwords
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                throw { status: 401, message: 'Invalid credentials' };
            }
            // Generate JWT token
            const accessToken = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret-key-for-development', { expiresIn: '7d' });
            // Return user data
            return {
                user,
                accessToken
            };
        }
        catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    // Get user by ID
    static async getUserById(userId) {
        try {
            // Ensure database is connected before proceeding
            await (0, mongodb_1.ensureDbConnected)();
            // Find user by ID
            const user = await user_1.default.findById(userId);
            if (!user) {
                throw { status: 404, message: 'User not found' };
            }
            // Return user without password
            const { password, ...userWithoutPassword } = user.toObject();
            return userWithoutPassword;
        }
        catch (error) {
            console.error('Get user error:', error);
            throw error;
        }
    }
}
exports.MongoAuthService = MongoAuthService;
