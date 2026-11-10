import { z } from "zod";
import { OrganizationType } from "@prisma/client";

// ==========================================
// POSITION SCHEMAS
// ==========================================

export const createPositionSchema = z.object({
  name: z
    .string({ required_error: "Nama jabatan wajib diisi." })
    .trim()
    .min(2, "Nama jabatan minimal 2 karakter.")
    .max(50, "Nama jabatan maksimal 50 karakter."),
  level: z
    .number({ required_error: "Level hierarki jabatan wajib diisi." })
    .int("Level jabatan harus berupa angka bulat.")
    .min(1, "Level minimal adalah 1.")
    .max(10, "Level maksimal adalah 10."),
  organization_type: z
    .nativeEnum(OrganizationType, {
      errorMap: () => ({ message: "Tipe organisasi harus OSIS, MPK, atau GENERAL." }),
    })
    .default(OrganizationType.GENERAL),
});

export const updatePositionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama jabatan minimal 2 karakter.")
    .max(50, "Nama jabatan maksimal 50 karakter.")
    .optional(),
  level: z
    .number()
    .int("Level jabatan harus berupa angka bulat.")
    .min(1, "Level minimal adalah 1.")
    .max(10, "Level maksimal adalah 10.")
    .optional(),
  organization_type: z
    .nativeEnum(OrganizationType, {
      errorMap: () => ({ message: "Tipe organisasi harus OSIS, MPK, atau GENERAL." }),
    })
    .optional(),
});

// ==========================================
// SEKBID SCHEMAS
// ==========================================

export const createSekbidSchema = z.object({
  number: z
    .number({ required_error: "Nomor sekbid wajib diisi." })
    .int("Nomor sekbid harus berupa angka bulat.")
    .min(1, "Nomor sekbid minimal 1.")
    .max(10, "Nomor sekbid harus berada pada rentang 1-10."),
  name: z
    .string({ required_error: "Nama bidang sekbid wajib diisi." })
    .trim()
    .min(2, "Nama sekbid minimal 2 karakter.")
    .max(100, "Nama sekbid maksimal 100 karakter."),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export const updateSekbidSchema = z.object({
  number: z
    .number()
    .int("Nomor sekbid harus berupa angka bulat.")
    .min(1, "Nomor sekbid minimal 1.")
    .max(10, "Nomor sekbid harus berada pada rentang 1-10.")
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, "Nama sekbid minimal 2 karakter.")
    .max(100, "Nama sekbid maksimal 100 karakter.")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

// ==========================================
// COMMISSION SCHEMAS
// ==========================================

export const createCommissionSchema = z.object({
  code: z
    .string({ required_error: "Kode komisi wajib diisi." })
    .trim()
    .min(1, "Kode komisi minimal 1 karakter.")
    .max(10, "Kode komisi maksimal 10 karakter.")
    .toUpperCase(),
  name: z
    .string({ required_error: "Nama komisi wajib diisi." })
    .trim()
    .min(2, "Nama komisi minimal 2 karakter.")
    .max(100, "Nama komisi maksimal 100 karakter."),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export const updateCommissionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode komisi minimal 1 karakter.")
    .max(10, "Kode komisi maksimal 10 karakter.")
    .toUpperCase()
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, "Nama komisi minimal 2 karakter.")
    .max(100, "Nama komisi maksimal 100 karakter.")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
export type CreateSekbidInput = z.infer<typeof createSekbidSchema>;
export type UpdateSekbidInput = z.infer<typeof updateSekbidSchema>;
export type CreateCommissionInput = z.infer<typeof createCommissionSchema>;
export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;
