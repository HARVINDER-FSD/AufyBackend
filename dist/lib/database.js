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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = exports.redisSub = exports.redisPub = exports.redis = void 0;
exports.connectToDatabase = connectToDatabase;
exports.getDatabase = getDatabase;
exports.query = query;
exports.transaction = transaction;
const mongodb_1 = require("mongodb");
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("./redis");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables if not already loaded
if (!process.env.MONGODB_URI) {
    dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../..', '.env') });
}
// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
// Log which database we're connecting to
console.log('='.repeat(80));
console.log('MongoDB Connection Configuration:');
console.log('Using connection:', MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud) ☁️' : 'Local MongoDB 💻');
console.log('Connection string:', MONGODB_URI.substring(0, 50) + '...');
console.log('='.repeat(80));
let cachedClient = null;
let cachedDb = null;
let mongooseConnected = false;
// Get MongoDB client and database
function connectToDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        // Connect Mongoose if not already connected
        if (!mongooseConnected) {
            try {
                yield mongoose_1.default.connect(MONGODB_URI, {
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    connectTimeoutMS: 10000,
                    maxPoolSize: 50,
                    minPoolSize: 5,
                    maxIdleTimeMS: 60000,
                });
                mongooseConnected = true;
                console.log('Mongoose connected successfully');
            }
            catch (error) {
                console.error('Failed to connect Mongoose:', error);
            }
        }
        if (cachedClient && cachedDb) {
            // Test if connection is still alive
            try {
                yield cachedDb.admin().ping();
                return { client: cachedClient, db: cachedDb };
            }
            catch (error) {
                console.log('Cached connection is stale, reconnecting...');
                cachedClient = null;
                cachedDb = null;
            }
        }
        try {
            const client = yield mongodb_1.MongoClient.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 10000,
                maxPoolSize: 50,
                minPoolSize: 5,
                maxIdleTimeMS: 60000,
                retryWrites: true,
                retryReads: true,
                w: 'majority'
            });
            const db = client.db();
            cachedClient = client;
            cachedDb = db;
            console.log('MongoDB connection established successfully');
            return { client, db };
        }
        catch (error) {
            console.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    });
}
// Export a function to get the database
function getDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        const { db } = yield connectToDatabase();
        return db;
    });
}
exports.redis = (0, redis_1.getRedis)();
exports.redisPub = exports.redis;
exports.redisSub = exports.redis;
// Check if Redis is available
const isRedisAvailable = !!exports.redis;
// MongoDB query helper with error handling and retry logic
function query(collectionName, operation) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = Date.now();
        let retries = 0;
        while (retries <= MAX_RETRIES) {
            try {
                const db = yield getDatabase();
                const collection = db.collection(collectionName);
                const result = yield operation(collection);
                const duration = Date.now() - start;
                console.log("Executed MongoDB operation", { collection: collectionName, duration });
                return result;
            }
            catch (error) {
                const isConnectionError = error.message && (error.message.includes('timeout') ||
                    error.message.includes('terminated') ||
                    error.message.includes('connection'));
                if (isConnectionError && retries < MAX_RETRIES) {
                    retries++;
                    console.log(`Database connection error, retrying (${retries}/${MAX_RETRIES})...`);
                    // Reset cached connection
                    cachedClient = null;
                    cachedDb = null;
                    yield new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    continue;
                }
                console.error("Database query error:", error);
                throw error;
            }
        }
        console.error("Database query failed after maximum retries");
        throw new Error("Database connection failed after multiple attempts");
    });
}
// MongoDB transaction helper
function transaction(callback) {
    return __awaiter(this, void 0, void 0, function* () {
        const { client } = yield connectToDatabase();
        const session = client.startSession();
        try {
            session.startTransaction();
            const result = yield callback(session);
            yield session.commitTransaction();
            return result;
        }
        catch (error) {
            yield session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    });
}
exports.cache = {
    get: redis_1.cacheGet,
    set: redis_1.cacheSet,
    del: redis_1.cacheDel,
    invalidatePattern: redis_1.cacheInvalidate,
};
