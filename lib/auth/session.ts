import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "../../types/auth";

export const SESSION_COOKIE_NAME = "osis_session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 hari

/**
 * Validasi dan ambil kunci rahasia untuk penandatanganan JWT.
 * Gagal seketika jika AUTH_SECRET tidak ada atau panjangnya < 32 karakter.
 */
export function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "SECURITY ERROR: AUTH_SECRET must be configured and contain at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret.trim());
}

/**
 * Buat signed JWT token untuk sesi pengguna dengan pembatasan algoritma HS256
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">
): Promise<string> {
  const secretKey = getSecretKey();

  return new SignJWT({
    sub: payload.sub,
    username: payload.username,
    email: payload.email,
    role: payload.role,
    admin_scope: payload.admin_scope,
    member_id: payload.member_id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

/**
 * Verifikasi signed JWT token secara ketat:
 * - Algoritma dibatasi hanya HS256
 * - Validasi integritas tanda tangan kriptografis
 * - Validasi waktu kedaluwarsa (exp) dan struktur payload
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      username: (payload.username as string) ?? "",
      email: (payload.email as string) ?? "",
      role: payload.role as SessionPayload["role"],
      admin_scope: (payload.admin_scope as SessionPayload["admin_scope"]) ?? null,
      member_id: (payload.member_id as string) ?? null,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    // Menolak token yang expired, invalid signature, atau malformed
    return null;
  }
}

/**
 * Opsi standar cookie HTTP-only yang aman
 */
export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
