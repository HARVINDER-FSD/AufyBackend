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
exports.verifyJwtToken = verifyJwtToken;
const jose_1 = require("jose");
/**
 * Verify JWT token
 */
function verifyJwtToken(token) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!token) {
            return null;
        }
        try {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192');
            const { payload } = yield (0, jose_1.jwtVerify)(token, secret);
            return {
                id: payload.userId,
                username: payload.username,
            };
        }
        catch (error) {
            console.error("Token verification error:", error);
            return null;
        }
    });
}
