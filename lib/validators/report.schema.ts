import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mengubah string kosong dari form GET menjadi undefined agar tidak gagal validasi. */
function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(ISO_DATE, "Format tanggal harus YYYY-MM-DD")
    .optional()
);

const optionalActivityId = z.preprocess(
  emptyToUndefined,
  z.string().uuid("ID kegiatan tidak valid").optional()
);

const optionalOrganization = z.preprocess(
  emptyToUndefined,
  z.enum(["OSIS", "MPK", "GENERAL"]).optional()
);

const includeInactive = z.preprocess(
  (value) => value === "1" || value === "true" || value === "on",
  z.boolean()
);

/**
 * Filter laporan kehadiran. Rentang tanggal memakai tanggal kalender WIB
 * (`ActivitySchedule.date` disimpan sebagai DATE tanpa zona waktu).
 */
export const reportQuerySchema = z
  .object({
    from: optionalDate,
    to: optionalDate,
    activity_id: optionalActivityId,
    organization: optionalOrganization,
    include_inactive: includeInactive,
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Tanggal awal tidak boleh melewati tanggal akhir.",
    path: ["to"],
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const REPORT_STATUS_COLUMNS = [
  "HADIR",
  "TERLAMBAT",
  "IZIN",
  "SAKIT",
  "ALPA",
  "DI_LUAR_JADWAL",
] as const;

export type ReportStatusKey = (typeof REPORT_STATUS_COLUMNS)[number];
