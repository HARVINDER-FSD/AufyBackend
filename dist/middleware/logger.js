"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
exports.requestId = requestId;
// src/middleware/logger.ts
const winston_1 = __importDefault(require("winston"));
const morgan_1 = __importDefault(require("morgan"));
const uuid_1 = require("uuid");
// Winston logger – JSON, timestamps, console transport
exports.logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [new winston_1.default.transports.Console()],
});
// Morgan stream that forwards to Winston
const stream = {
    write: (message) => {
        // Morgan already outputs a JSON string
        try {
            const obj = JSON.parse(message);
            exports.logger.info('http', obj);
        }
        catch (_a) {
            exports.logger.info(message.trim());
        }
    },
};
// Request‑ID middleware – attaches a UUID to each request and to logger
function requestId(req, _res, next) {
    const id = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.id = id; // augment Request type via declaration merging (handled elsewhere)
    // expose header for downstream services
    _res.setHeader('X-Request-Id', id);
    next();
}
// Morgan logger middleware – should be placed after requestId
exports.httpLogger = (0, morgan_1.default)(':method :url :status :response-time ms - :res[content-length]', { stream });
