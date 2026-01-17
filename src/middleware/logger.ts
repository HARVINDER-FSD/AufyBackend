// src/middleware/logger.ts
import winston from 'winston';
import morgan, { StreamOptions } from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

// Winston logger – JSON, timestamps, console transport
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

// Morgan stream that forwards to Winston
const stream: StreamOptions = {
    write: (message) => {
        // Morgan already outputs a JSON string
        try {
            const obj = JSON.parse(message);
            logger.info('http', obj);
        } catch {
            logger.info(message.trim());
        }
    },
};

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}

// Request‑ID middleware – attaches a UUID to each request and to logger
export function requestId(req: Request, _res: Response, next: NextFunction) {
    const id = (req.headers['x-request-id'] as string) || uuidv4();
    req.id = id; // augment Request type via declaration merging (handled elsewhere)
    // expose header for downstream services
    _res.setHeader('X-Request-Id', id);
    next();
}

// Morgan logger middleware – should be placed after requestId
export const httpLogger = morgan(
    ':method :url :status :response-time ms - :res[content-length]',
    { stream }
);
