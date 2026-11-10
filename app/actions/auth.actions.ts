"use server";

import { redirect } from "next/navigation";
import { authenticateUser, logoutUser } from "@/lib/auth";
import { sanitizeRedirectUrl } from "@/lib/auth/security";
import type { LoginInput } from "@/lib/validators/auth.schema";

export interface LoginActionState {
  error?: string;
}

/**
 * Server Action: Proses login pengguna.
 * Dipanggil dari Client Component LoginForm melalui form action.
 * redirect() harus dipanggil di luar try/catch per dokumentasi Next.js.
 */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const input: LoginInput = {
    usernameOrEmail: (formData.get("usernameOrEmail") as string) ?? "",
    password: (formData.get("password") as string) ?? "",
  };

  const result = await authenticateUser(input);

  if (!result.success) {
    return { error: result.error ?? "Terjadi kesalahan saat login." };
  }

  // Sanitasi redirect param sebelum digunakan
  const redirectParam = formData.get("redirect") as string | null;
  const destination = sanitizeRedirectUrl(redirectParam, "/dashboard");

  redirect(destination);
}

/**
 * Server Action: Logout pengguna dan arahkan ke halaman login.
 */
export async function logoutAction(): Promise<void> {
  await logoutUser();
  redirect("/login");
}
