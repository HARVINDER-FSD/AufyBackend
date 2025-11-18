import { jwtVerify } from "jose";

/**
 * Verify JWT token
 */
export async function verifyJwtToken(token: string) {
  if (!token) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192');
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.userId as string,
      username: payload.username as string,
    };
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}