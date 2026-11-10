import { z } from "zod";

/**
 * Skema validasi untuk registrasi perangkat IoT baru.
 * Hanya SUPERADMIN yang dapat mengakses endpoint ini.
 */
export const registerDeviceSchema = z.object({
  device_code: z
    .string({ required_error: "Kode perangkat wajib diisi." })
    .trim()
    .toUpperCase()
    .min(3, "Kode perangkat minimal 3 karakter.")
    .max(100, "Kode perangkat maksimal 100 karakter.")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Kode perangkat hanya boleh berisi huruf besar, angka, underscore, dan hyphen."
    ),
  name: z
    .string({ required_error: "Nama perangkat wajib diisi." })
    .trim()
    .min(2, "Nama perangkat minimal 2 karakter.")
    .max(100, "Nama perangkat maksimal 100 karakter."),
  location: z
    .string({ required_error: "Lokasi perangkat wajib diisi." })
    .trim()
    .min(2, "Lokasi perangkat minimal 2 karakter.")
    .max(200, "Lokasi perangkat maksimal 200 karakter."),
});

/**
 * Skema validasi untuk memperbarui data perangkat (name, location, is_active).
 * Tidak mengizinkan perubahan device_code.
 */
export const updateDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama perangkat minimal 2 karakter.")
    .max(100, "Nama perangkat maksimal 100 karakter.")
    .optional(),
  location: z
    .string()
    .trim()
    .min(2, "Lokasi perangkat minimal 2 karakter.")
    .max(200, "Lokasi perangkat maksimal 200 karakter.")
    .optional(),
  is_active: z.boolean().optional(),
});

/**
 * Skema validasi query parameter daftar perangkat.
 */
export const deviceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  sort_by: z.enum(["name", "device_code", "created_at", "last_seen"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type DeviceQueryInput = z.infer<typeof deviceQuerySchema>;
