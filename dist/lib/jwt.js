"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJwtToken = verifyJwtToken;
const jose_1 = require("jose");
/**
 * Verify JWT token
 */
async function verifyJwtToken(token) {
    if (!token) {
        return null;
    }
    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192');
        const { payload } = await (0, jose_1.jwtVerify)(token, secret);
        return {
            id: payload.userId,
            username: payload.username,
        };
    }
    catch (error) {
        console.error("Token verification error:", error);
        return null;
    }
}
