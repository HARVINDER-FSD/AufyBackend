"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorResponse = getErrorResponse;
exports.verifyJwtToken = verifyJwtToken;
exports.getAuthUserId = getAuthUserId;
const server_1 = require("next/server");
const jose_1 = require("jose");
const headers_1 = require("next/headers");
/**
 * Helper function to return standardized error responses
 */
function getErrorResponse(message, status = 500) {
    return server_1.NextResponse.json({ error: message }, { status });
}
/**
 * Verify JWT token from cookies
 */
async function verifyJwtToken(token) {
    if (!token) {
        return null;
    }
    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192');
        const { payload } = await (0, jose_1.jwtVerify)(token, secret);
        return { id: payload.userId, ...payload };
    }
    catch (error) {
        console.error('Invalid token:', error);
        return null;
    }
}
/**
 * Get authenticated user ID from cookies
 */
async function getAuthUserId() {
    const cookieStore = (0, headers_1.cookies)();
    const token = cookieStore.get('token')?.value;
    if (!token) {
        return null;
    }
    const verifiedToken = await verifyJwtToken(token);
    return verifiedToken?.id || null;
}
