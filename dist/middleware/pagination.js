"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
/**
 * Standard pagination middleware.
 * Supports both cursor-based (cursor) and offset-based (page/limit) params.
 */
function paginate(req, _res, next) {
    const limit = Math.min(Number.parseInt(req.query.limit) || 20, 100);
    const cursor = req.query.cursor;
    const page = Number.parseInt(req.query.page) || 1;
    req.pagination = { limit, cursor, page };
    next();
}
