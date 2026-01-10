"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoAuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_1 = __importDefault(require("../models/user"));
const mongodb_1 = require("./mongodb");
// MongoDB Auth Service (Real implementation)
class MongoAuthService {
    // Register a new user
    static register(_a) {
        return __awaiter(this, arguments, void 0, function* ({ username, email, password, full_name }) {
            try {
                // Ensure database is connected before proceeding
                const { db } = yield (0, mongodb_1.connectToDatabase)();
                // Check if user already exists
                const existingUser = yield user_1.default.findOne({
                    $or: [{ email }, { username }]
                });
                if (existingUser) {
                    throw { status: 400, message: 'User already exists' };
                }
                // Hash password
                const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
                // Create new user
                const user = yield user_1.default.create({
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
        });
    }
    // Login user
    static login(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, password }) {
            try {
                // Ensure database is connected before proceeding
                const { db } = yield (0, mongodb_1.connectToDatabase)();
                // Find user by email
                const user = yield user_1.default.findOne({ email });
                if (!user) {
                    throw { status: 401, message: 'Invalid credentials' };
                }
                // Compare passwords
                const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
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
        });
    }
    // Get user by ID
    static getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure database is connected before proceeding
                const { db } = yield (0, mongodb_1.connectToDatabase)();
                // Find user by ID
                const user = yield user_1.default.findById(userId);
                if (!user) {
                    throw { status: 404, message: 'User not found' };
                }
                // Return user without password
                const _a = user.toObject(), { password } = _a, userWithoutPassword = __rest(_a, ["password"]);
                return userWithoutPassword;
            }
            catch (error) {
                console.error('Get user error:', error);
                throw error;
            }
        });
    }
}
exports.MongoAuthService = MongoAuthService;
