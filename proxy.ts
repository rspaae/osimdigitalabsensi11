import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { sanitizeRedirectUrl, validateRequestOrigin } from "@/lib/auth/security";

const SESSION_COOKIE_NAME = "osis_session";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "SECURITY ERROR: AUTH_SECRET must be configured and contain at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret.trim());
}

// Daftar rute dashboard & pengelolaan yang mewajibkan sesi login web
const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/members",
  "/executives",
  "/divisions",
  "/activities",
  "/schedules",
  "/attendance",
  "/violations",
  "/reports",
  "/settings",
  "/devices",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Abaikan aset statis internal Next.js dan file publik
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/v1/iot") ||       // Endpoint ESP32 IoT memiliki otentikasi Device API Key
    pathname === "/api/v1/attendance/scan" ||   // Endpoint pemindaian RFID perangkat scanner
    pathname === "/api/v1/devices/heartbeat" || // Endpoint heartbeat status koneksi ESP32
    pathname === "/api/health" ||               // Public health check endpoint
    pathname === "/api/auth/setup-superadmin" || // Initial Superadmin onboarding endpoint
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Proteksi CSRF untuk request mutasi state (POST, PUT, DELETE, PATCH)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    if (!validateRequestOrigin(request)) {
      return NextResponse.json(
        { error: "CSRF Validation Failed: Origin mismatch detected." },
        { status: 403 }
      );
    }
  }

  // 3. Baca dan verifikasi cookie sesi
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    try {
      const secretKey = getSecretKey();
      await jwtVerify(sessionCookie, secretKey, { algorithms: ["HS256"] });
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // 4. Jika pengguna sudah login dan mencoba mengakses /login, redirect ke /dashboard
  if (pathname === "/login") {
    if (isAuthenticated) {
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      const safeRedirect = sanitizeRedirectUrl(redirectParam, "/dashboard");
      return NextResponse.redirect(new URL(safeRedirect, request.url));
    }
    return NextResponse.next();
  }

  // 5. Periksa apakah rute saat ini termasuk rute terproteksi
  const isProtectedPath = PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedPath) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      const safeRedirect = sanitizeRedirectUrl(pathname, "/dashboard");
      loginUrl.searchParams.set("redirect", safeRedirect);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 6. Proteksi API internal (selain endpoint publik atau IoT)
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/v1/iot/") &&
    pathname !== "/api/health" &&
    pathname !== "/api/auth/setup-superadmin"
  ) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized: Otentikasi sesi dibutuhkan." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
