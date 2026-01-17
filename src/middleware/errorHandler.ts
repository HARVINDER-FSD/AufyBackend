// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Central error handling middleware.
 * All async errors (thanks to `express-async-errors`) flow here.
 * It distinguishes between operational errors (client‑side) and programmer errors.
 */
export function errorHandler(
    err: any,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
) {
    const status = err.status || 500;
    const isOperational = err.isOperational ?? false;

    // Log the error with request id if available
    logger.error('Unhandled error', {
        message: err.message,
        status,
        stack: err.stack,
        // @ts-ignore – requestId may be attached via requestId middleware
        requestId: _req.id,
    });

    // Do not leak internal details for 5xx errors
    const responseMessage = status >= 500 && !isOperational ? 'Internal Server Error' : err.message;

    res.status(status).json({ error: responseMessage });
}
