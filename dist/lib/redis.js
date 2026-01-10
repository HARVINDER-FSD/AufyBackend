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
exports.cacheInvalidate = exports.cacheDel = exports.cacheSet = exports.cacheGet = exports.getRedis = exports.initRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
let redis = null;
const initRedis = () => {
    if (redis)
        return redis;
    try {
        // Check if using Upstash Redis (REST API)
        const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
        const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (upstashUrl && upstashToken) {
            // Parse Upstash URL to get host and port
            // Format: https://host:port
            const url = new URL(upstashUrl);
            const host = url.hostname;
            const port = url.port || 6379;
            // Extract password from token (Upstash uses token as password)
            const password = upstashToken;
            console.log(`🔗 Connecting to Upstash Redis: ${host}:${port}`);
            redis = new ioredis_1.default({
                host,
                port: parseInt(port.toString()),
                password,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: null,
                tls: {}, // Enable TLS for Upstash
            });
        }
        else {
            // Fallback to local Redis
            console.log('🔗 Connecting to local Redis');
            redis = new ioredis_1.default({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: null,
            });
        }
        redis.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });
        redis.on('error', (err) => {
            console.error('❌ Redis error:', err);
        });
        return redis;
    }
    catch (error) {
        console.error('Failed to initialize Redis:', error);
        return null;
    }
};
exports.initRedis = initRedis;
const getRedis = () => {
    if (!redis) {
        return (0, exports.initRedis)();
    }
    return redis;
};
exports.getRedis = getRedis;
// Cache helpers
const cacheGet = (key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return null;
        const data = yield redis.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        console.error('Cache get error:', error);
        return null;
    }
});
exports.cacheGet = cacheGet;
const cacheSet = (key_1, value_1, ...args_1) => __awaiter(void 0, [key_1, value_1, ...args_1], void 0, function* (key, value, ttl = 3600) {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return false;
        yield redis.setex(key, ttl, JSON.stringify(value));
        return true;
    }
    catch (error) {
        console.error('Cache set error:', error);
        return false;
    }
});
exports.cacheSet = cacheSet;
const cacheDel = (key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return false;
        yield redis.del(key);
        return true;
    }
    catch (error) {
        console.error('Cache delete error:', error);
        return false;
    }
});
exports.cacheDel = cacheDel;
const cacheInvalidate = (pattern) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const redis = (0, exports.getRedis)();
        if (!redis)
            return false;
        const keys = yield redis.keys(pattern);
        if (keys.length > 0) {
            yield redis.del(...keys);
        }
        return true;
    }
    catch (error) {
        console.error('Cache invalidate error:', error);
        return false;
    }
});
exports.cacheInvalidate = cacheInvalidate;
