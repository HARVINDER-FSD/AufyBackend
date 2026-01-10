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
function verifyJwtToken(token) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!token) {
            return null;
        }
        try {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192');
            const { payload } = yield (0, jose_1.jwtVerify)(token, secret);
            return Object.assign({ id: payload.userId }, payload);
        }
        catch (error) {
            console.error('Invalid token:', error);
            return null;
        }
    });
}
/**
 * Get authenticated user ID from cookies
 */
function getAuthUserId() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const cookieStore = (0, headers_1.cookies)();
        const token = (_a = cookieStore.get('token')) === null || _a === void 0 ? void 0 : _a.value;
        if (!token) {
            return null;
        }
        const verifiedToken = yield verifyJwtToken(token);
        return (verifiedToken === null || verifiedToken === void 0 ? void 0 : verifiedToken.id) || null;
    });
}
