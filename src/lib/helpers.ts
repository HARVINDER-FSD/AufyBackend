import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Helper function to return standardized error responses
 */
export function getErrorResponse(message: string, status: number = 500) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

/**
 * Verify JWT token from cookies
 */
export async function verifyJwtToken(token: string) {
  if (!token) {
    return null;
  }
  
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192');
    const { payload } = await jwtVerify(token, secret);
    return { id: payload.userId, ...payload };
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
}

/**
 * Get authenticated user ID from cookies
 */
export async function getAuthUserId() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;
  
  if (!token) {
    return null;
  }
  
  const verifiedToken = await verifyJwtToken(token);
  return verifiedToken?.id || null;
}