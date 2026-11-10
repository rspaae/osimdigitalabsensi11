import { getSessionFromCookies } from "./cookies";
import { prisma } from "@/lib/db/prisma";
import { assertAuthorized } from "./rbac";
import type { AuthenticatedUser, AppModule, PermissionAction } from "../../types/auth";

export class AuthenticationError extends Error {
  public code: string;

  constructor(
    message = "Sesi login tidak sah, telah kedaluwarsa, atau akun dinonaktifkan.",
    code = "UNAUTHORIZED"
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

/**
 * Mengambil informasi pengguna dari JWT cookie yang terverifikasi (tanpa query database).
 * Berguna untuk keperluan presentasi UI / non-sensitive render.
 */
export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }

  return {
    id: session.sub,
    username: session.username,
    email: session.email,
    role: session.role,
    admin_scope: session.admin_scope,
    member_id: session.member_id,
  };
}

/**
 * FRESH AUTHORIZATION:
 * Mengambil konteks pengguna langsung dari DATABASE untuk operasi sensitif.
 * Memastikan bahwa perubahan role, perubahan admin_scope, atau penonaktifan akun (is_active: false)
 * langsung berlaku seketika tanpa mempercayai data klaim token JWT lama.
 * 
 * Mengembalikan NULL jika user tidak ditemukan, akun non-aktif, atau koneksi DB gagal.
 * (Tidak ada fallback ke klaim JWT usang).
 */
export async function getFreshUser(): Promise<AuthenticatedUser | null> {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        admin_scope: true,
        member_id: true,
        is_active: true,
      },
    });

    // Tolak seketika jika akun tidak ada atau statusnya non-aktif
    if (!dbUser || !dbUser.is_active) {
      return null;
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role,
      admin_scope: dbUser.admin_scope,
      member_id: dbUser.member_id,
    };
  } catch (error) {
    // Pada operasi sensitif, kegagalan database tidak boleh di-bypass menggunakan token usang.
    console.error(
      "[getFreshUser] Gagal memverifikasi user di database:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Memastikan request memiliki pengguna terotentikasi aktif dari database.
 * Melempar AuthenticationError jika tidak sah.
 */
export async function requireFreshUser(): Promise<AuthenticatedUser> {
  const user = await getFreshUser();
  if (!user) {
    throw new AuthenticationError();
  }
  return user;
}

/**
 * Guard tingkat server untuk Server Actions / Route Handlers:
 * 1. Mengambil data segar pengguna dari database (Fresh User)
 * 2. Memeriksa izin modul dan aksi yang bersangkutan (RBAC & Scope)
 * 3. Melempar error jika otentikasi atau otorisasi gagal
 */
export async function requirePermission(
  module: AppModule,
  action: PermissionAction
): Promise<AuthenticatedUser> {
  const user = await requireFreshUser();
  assertAuthorized(user, module, action);
  return user;
}

// Alias default untuk kompatibilitas ke belakang
export const getCurrentUser = getFreshUser;
