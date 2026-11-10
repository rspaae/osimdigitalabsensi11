import { z } from "zod";
import { ActivityType } from "@prisma/client";

export const createActivitySchema = z.object({
  code: z
    .string({ required_error: "Kode kegiatan wajib diisi." })
    .trim()
    .min(2, "Kode kegiatan minimal 2 karakter.")
    .max(50, "Kode kegiatan maksimal 50 karakter.")
    .regex(/^[A-Z0-9_-]+$/, "Kode kegiatan hanya boleh berisi huruf besar, angka, underscore, dan hyphen.")
    .toUpperCase(),
  name: z
    .string({ required_error: "Nama kegiatan wajib diisi." })
    .trim()
    .min(2, "Nama kegiatan minimal 2 karakter.")
    .max(100, "Nama kegiatan maksimal 100 karakter."),
  type: z
    .nativeEnum(ActivityType, {
      errorMap: () => ({ message: "Tipe kegiatan harus ROUTINE atau SPECIAL." }),
    })
    .default(ActivityType.ROUTINE),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi kegiatan maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  default_late_threshold_minutes: z
    .number({ required_error: "Ambang batas keterlambatan default wajib diisi." })
    .int("Menit keterlambatan harus berupa bilangan bulat.")
    .min(1, "Ambang batas keterlambatan minimal 1 menit.")
    .max(180, "Ambang batas keterlambatan maksimal 180 menit (3 jam).")
    .default(15),
  is_active: z.boolean().default(true),
});

export const updateActivitySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode kegiatan minimal 2 karakter.")
    .max(50, "Kode kegiatan maksimal 50 karakter.")
    .regex(/^[A-Z0-9_-]+$/, "Kode kegiatan hanya boleh berisi huruf besar, angka, underscore, dan hyphen.")
    .toUpperCase()
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, "Nama kegiatan minimal 2 karakter.")
    .max(100, "Nama kegiatan maksimal 100 karakter.")
    .optional(),
  type: z
    .nativeEnum(ActivityType, {
      errorMap: () => ({ message: "Tipe kegiatan harus ROUTINE atau SPECIAL." }),
    })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi kegiatan maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  default_late_threshold_minutes: z
    .number()
    .int("Menit keterlambatan harus berupa bilangan bulat.")
    .min(1, "Ambang batas keterlambatan minimal 1 menit.")
    .max(180, "Ambang batas keterlambatan maksimal 180 menit.")
    .optional(),
  is_active: z.boolean().optional(),
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  type: z.nativeEnum(ActivityType).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  sort_by: z.enum(["name", "code", "created_at"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;
