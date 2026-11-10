import { z } from "zod";

export const setupSuperadminSchema = z.object({
  username: z
    .string({ required_error: "Username wajib diisi" })
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore (_)"),
  email: z
    .string({ required_error: "Email wajib diisi" })
    .trim()
    .email("Format alamat email tidak valid"),
  password: z
    .string({ required_error: "Password wajib diisi" })
    .min(8, "Password minimal 8 karakter"),
  setupSecret: z
    .string({ required_error: "Setup secret wajib diisi" })
    .min(1, "Setup secret wajib diisi"),
});

export type SetupSuperadminInput = z.infer<typeof setupSuperadminSchema>;
