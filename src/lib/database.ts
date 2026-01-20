import { MongoClient, Db } from "mongodb"
import mongoose from "mongoose"
import { getRedis, cacheGet, cacheSet, cacheDel, cacheInvalidate } from "./redis"
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables if not already loaded
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../..', '.env') })
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Log which database we're connecting to
console.log('='.repeat(80))
console.log('MongoDB Connection Configuration:')
console.log('Using connection:', MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud) ☁️' : 'Local MongoDB 💻')
console.log('Connection string:', MONGODB_URI.substring(0, 50) + '...')
console.log('='.repeat(80))

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let mongooseConnected = false;

// Get MongoDB client and database
export async function connectToDatabase() {
  // Connect Mongoose if not already connected
  if (!mongooseConnected) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        maxPoolSize: 200, // Increased for heavy load (was 50)
        minPoolSize: 20, // Increased minimum (was 5)
        maxIdleTimeMS: 60000,
      });
      mongooseConnected = true;
      console.log('Mongoose connected successfully');
    } catch (error) {
      console.error('Failed to connect Mongoose:', error);
    }
  }

  if (cachedClient && cachedDb) {
    // Return cached connection directly
    // The driver handles reconnection automatically
    return { client: cachedClient, db: cachedDb };
  }

  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 200, // Increased for heavy load (was 50)
      minPoolSize: 20, // Increased minimum (was 5)
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
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Export a function to get the database
export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export const redis = getRedis()

export const redisPub = redis
export const redisSub = redis

// Check if Redis is available
const isRedisAvailable = !!redis

// MongoDB query helper with error handling and retry logic
export async function query(collectionName: string, operation: (collection: any) => Promise<any>) {
  const start = Date.now();
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      const db = await getDatabase();
      const collection = db.collection(collectionName);
      const result = await operation(collection);
      const duration = Date.now() - start;
      console.log("Executed MongoDB operation", { collection: collectionName, duration });
      return result;
    } catch (error: any) {
      const isConnectionError = error.message && (
        error.message.includes('timeout') ||
        error.message.includes('terminated') ||
        error.message.includes('connection')
      );

      if (isConnectionError && retries < MAX_RETRIES) {
        retries++;
        console.log(`Database connection error, retrying (${retries}/${MAX_RETRIES})...`);
        // Reset cached connection
        cachedClient = null;
        cachedDb = null;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        continue;
      }

      console.error("Database query error:", error);
      throw error;
    }
  }

  console.error("Database query failed after maximum retries");
  throw new Error("Database connection failed after multiple attempts");
}

// MongoDB transaction helper
export async function transaction<T>(callback: (session: any) => Promise<T>): Promise<T> {
  const { client } = await connectToDatabase();
  const session = client.startSession();

  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export const cache = {
  get: cacheGet,
  set: cacheSet,
  del: cacheDel,
  invalidatePattern: cacheInvalidate,
}
