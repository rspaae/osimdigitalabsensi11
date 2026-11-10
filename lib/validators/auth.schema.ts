import { z } from "zod";

export const loginSchema = z.object({
  usernameOrEmail: z
    .string({
      required_error: "Username atau email wajib diisi",
    })
    .trim()
    .min(3, "Username atau email minimal 3 karakter"),
  password: z
    .string({
      required_error: "Password wajib diisi",
    })
    .min(6, "Password minimal 6 karakter"),
});

export type LoginInput = z.infer<typeof loginSchema>;
