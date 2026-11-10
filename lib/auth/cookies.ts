import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  verifySessionToken,
} from "./session";
import type { SessionPayload } from "../../types/auth";

/**
 * Simpan token sesi ke dalam HTTP-only cookie (Server Action / Route Handler)
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const options = getSessionCookieOptions();

  cookieStore.set(options.name, token, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
    maxAge: options.maxAge,
  });
}

/**
 * Hapus cookie sesi saat logout dengan mengatur maxAge = 0
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Baca dan verifikasi payload sesi dari HTTP cookies
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  return verifySessionToken(sessionCookie.value);
}
