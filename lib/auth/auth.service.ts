import { loginSchema, type LoginInput } from "@/lib/validators/auth.schema";
import { verifyPassword } from "./password";
import { createSessionToken } from "./session";
import { setSessionCookie, deleteSessionCookie } from "./cookies";
import { prisma } from "@/lib/db/prisma";
import type { AuthenticatedUser } from "../../types/auth";

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

/**
 * Otentikasi login pengguna berbasis username atau email.
 * Memastikan proteksi password hash dan blokir akun non-aktif.
 */
export async function authenticateUser(input: LoginInput): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Input tidak valid",
    };
  }

  const { usernameOrEmail, password } = parsed.data;

  // Cari akun berdasarkan username ATAU email
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: usernameOrEmail },
        { email: usernameOrEmail },
      ],
    },
  });

  // Pesan error seragam untuk mencegah username enumeration
  if (!user) {
    return {
      success: false,
      error: "Username/email atau password salah",
    };
  }

  // Cek keaktifan akun pengguna
  if (!user.is_active) {
    return {
      success: false,
      error: "Akun Anda telah dinonaktifkan. Silakan hubungi Superadmin.",
    };
  }

  // Verifikasi hash password
  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    return {
      success: false,
      error: "Username/email atau password salah",
    };
  }

  // Siapkan payload sesi yang aman
  const token = await createSessionToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    admin_scope: user.admin_scope,
    member_id: user.member_id,
  });

  // Simpan ke HTTP-only cookie
  await setSessionCookie(token);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      admin_scope: user.admin_scope,
      member_id: user.member_id,
    },
  };
}

/**
 * Logout pengguna dengan menghapus cookie sesi
 */
export async function logoutUser(): Promise<void> {
  await deleteSessionCookie();
}
