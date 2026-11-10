import { z } from "zod";

export const createMemberPositionSchema = z
  .object({
    member_id: z.string({ required_error: "ID Anggota (member_id) wajib diisi." }).uuid("ID Anggota harus berformat UUID."),
    position_id: z.string({ required_error: "ID Jabatan (position_id) wajib diisi." }).uuid("ID Jabatan harus berformat UUID."),
    sekbid_id: z.string().uuid("ID Sekbid harus berformat UUID.").optional().nullable().transform((val) => (val === "" ? null : val)),
    commission_id: z.string().uuid("ID Komisi harus berformat UUID.").optional().nullable().transform((val) => (val === "" ? null : val)),
    period_year: z
      .string({ required_error: "Tahun periode jabatan wajib diisi." })
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format periode harus YYYY/YYYY (contoh: 2025/2026)."),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => !(data.sekbid_id && data.commission_id),
    {
      message: "Penugasan jabatan tidak boleh menetapkan Sekbid dan Komisi secara bersamaan.",
      path: ["sekbid_id"],
    }
  );

export const updateMemberPositionSchema = z
  .object({
    position_id: z.string().uuid("ID Jabatan harus berformat UUID.").optional(),
    sekbid_id: z.string().uuid("ID Sekbid harus berformat UUID.").optional().nullable().transform((val) => (val === "" ? null : val)),
    commission_id: z.string().uuid("ID Komisi harus berformat UUID.").optional().nullable().transform((val) => (val === "" ? null : val)),
    period_year: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format periode harus YYYY/YYYY (contoh: 2025/2026).")
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => !(data.sekbid_id && data.commission_id),
    {
      message: "Penugasan jabatan tidak boleh menetapkan Sekbid dan Komisi secara bersamaan.",
      path: ["sekbid_id"],
    }
  );

export const memberPositionQuerySchema = z.object({
  member_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  sekbid_id: z.string().uuid().optional(),
  commission_id: z.string().uuid().optional(),
  period_year: z.string().optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
});

export type CreateMemberPositionInput = z.infer<typeof createMemberPositionSchema>;
export type UpdateMemberPositionInput = z.infer<typeof updateMemberPositionSchema>;
export type MemberPositionQueryInput = z.infer<typeof memberPositionQuerySchema>;
