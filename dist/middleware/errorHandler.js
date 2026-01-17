"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("./logger");
/**
 * Central error handling middleware.
 * All async errors (thanks to `express-async-errors`) flow here.
 * It distinguishes between operational errors (client‑side) and programmer errors.
 */
function errorHandler(err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    var _a;
    const status = err.status || 500;
    const isOperational = (_a = err.isOperational) !== null && _a !== void 0 ? _a : false;
    // Log the error with request id if available
    logger_1.logger.error('Unhandled error', {
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
