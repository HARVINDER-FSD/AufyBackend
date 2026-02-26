// src/middleware/pagination.ts
import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include pagination properties
declare global {
    namespace Express {
        interface Request {
            pagination: {
                limit: number;
                cursor?: string;
                page?: number; // fallback for offset-based
            };
        }
    }
}

/**
 * Standard pagination middleware.
 * Supports both cursor-based (cursor) and offset-based (page/limit) params.
 */
export function paginate(req: Request, _res: Response, next: NextFunction) {
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const page = Math.max(Number.parseInt(req.query.page as string) || 1, 1);

    req.pagination = { limit, cursor, page };
    next();
}
