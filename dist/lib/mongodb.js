"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.clientPromise = void 0;
exports.connectToDatabase = connectToDatabase;
const mongodb_1 = require("mongodb");
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// MongoDB connection - Use Atlas from environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
let clientPromise;
// Connection options with increased timeout for better reliability
const connectionOptions = {
    serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10
};
// Initialize MongoDB connection
async function initMongo() {
    if (!global._mongoClientPromise) {
        try {
            console.log('Connecting to MongoDB at:', MONGODB_URI);
            // Connect mongoose with proper options
            await mongoose_1.default.connect(MONGODB_URI, connectionOptions);
            console.log('Mongoose connected successfully');
            // Connect MongoDB client
            const client = new mongodb_1.MongoClient(MONGODB_URI, connectionOptions);
            global._mongoClientPromise = client.connect();
            // Test the connection
            const testClient = await global._mongoClientPromise;
            await testClient.db().command({ ping: 1 });
            console.log('MongoDB connection verified successfully');
        }
        catch (error) {
            console.error('MongoDB initialization error:', error);
            throw error;
        }
    }
    return global._mongoClientPromise;
}
// Initialize connection immediately to ensure it's ready before models are used
exports.clientPromise = clientPromise = global._mongoClientPromise || initMongo();
// User schema for authentication
const userSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    full_name: { type: String },
    avatar_url: { type: String },
    is_verified: { type: Boolean, default: false },
    is_private: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});
// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcryptjs_1.default.genSalt(10);
        this.password = await bcryptjs_1.default.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcryptjs_1.default.compare(candidatePassword, this.password);
    }
    catch (error) {
        throw error;
    }
};
// Create User model
const UserModel = mongoose_1.default.models.User || mongoose_1.default.model('User', userSchema);
exports.UserModel = UserModel;
// Function to connect to the database
async function connectToDatabase() {
    try {
        const client = await clientPromise;
        const db = client.db();
        return { client, db };
    }
    catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
    }
}
