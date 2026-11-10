import { z } from "zod";
import { OrganizationType, MemberStatus } from "@prisma/client";
import { normalizeRfidUid } from "@/lib/utils/rfid";

export const createMemberSchema = z.object({
  nis: z
    .string()
    .trim()
    .min(3, "NIS minimal 3 karakter.")
    .max(20, "NIS maksimal 20 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  nisn: z
    .string()
    .trim()
    .max(20, "NISN maksimal 20 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  full_name: z
    .string({ required_error: "Nama lengkap wajib diisi." })
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(100, "Nama lengkap maksimal 100 karakter."),
  class_grade: z
    .string()
    .trim()
    .min(2, "Kelas minimal 2 karakter.")
    .max(50, "Kelas maksimal 50 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  organization_type: z.nativeEnum(OrganizationType, {
    errorMap: () => ({ message: "Tipe organisasi harus OSIS, MPK, atau GENERAL." }),
  }),
  rfid_uid: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val, ctx) => {
      if (!val || val === "") return null;
      try {
        return normalizeRfidUid(val);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "UID RFID tidak valid.",
        });
        return z.NEVER;
      }
    }),
  photo_url: z
    .string()
    .trim()
    .url("URL foto tidak valid.")
    .max(255, "URL foto maksimal 255 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  status: z
    .nativeEnum(MemberStatus, {
      errorMap: () => ({ message: "Status harus ACTIVE, INACTIVE, atau ALUMNI." }),
    })
    .default(MemberStatus.ACTIVE),
});

export const updateMemberSchema = z.object({
  nis: z
    .string()
    .trim()
    .min(3, "NIS minimal 3 karakter.")
    .max(20, "NIS maksimal 20 karakter.")
    .optional(),
  nisn: z
    .string()
    .trim()
    .max(20, "NISN maksimal 20 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  full_name: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(100, "Nama lengkap maksimal 100 karakter.")
    .optional(),
  class_grade: z
    .string()
    .trim()
    .min(2, "Kelas minimal 2 karakter.")
    .max(50, "Kelas maksimal 50 karakter.")
    .optional(),
  organization_type: z
    .nativeEnum(OrganizationType, {
      errorMap: () => ({ message: "Tipe organisasi harus OSIS, MPK, atau GENERAL." }),
    })
    .optional(),
  rfid_uid: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val, ctx) => {
      if (!val || val === "") return null;
      try {
        return normalizeRfidUid(val);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "UID RFID tidak valid.",
        });
        return z.NEVER;
      }
    }),
  photo_url: z
    .string()
    .trim()
    .url("URL foto tidak valid.")
    .max(255, "URL foto maksimal 255 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  status: z
    .nativeEnum(MemberStatus, {
      errorMap: () => ({ message: "Status harus ACTIVE, INACTIVE, atau ALUMNI." }),
    })
    .optional(),
});

export const memberQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  class_grade: z.string().trim().optional(),
  organization_type: z.nativeEnum(OrganizationType).optional(),
  status: z.nativeEnum(MemberStatus).optional(),
  sort_by: z.enum(["full_name", "nis", "class_grade", "created_at"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type MemberQueryInput = z.infer<typeof memberQuerySchema>;
