import { z } from "zod";
import { AttendanceStatus, AttendanceMethod } from "@prisma/client";
import { normalizeRfidUid } from "@/lib/utils/rfid";

/**
 * Skema validasi untuk pemindaian RFID dari perangkat ESP32.
 * Otomatis menormalisasi rfid_uid ke format kanonikal huruf besar hex tanpa pemisah.
 */
export const rfidScanSchema = z.object({
  device_code: z
    .string({ required_error: "Kode perangkat wajib diisi." })
    .trim()
    .min(1, "Kode perangkat tidak boleh kosong."),
  rfid_uid: z
    .string({ required_error: "UID RFID wajib diisi." })
    .trim()
    .min(1, "UID RFID tidak boleh kosong.")
    .transform((val, ctx) => {
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
});

/**
 * Skema validasi untuk pembuatan absensi manual.
 * ALPA tidak diizinkan — hanya melalui rekonsiliasi.
 */
export const createAttendanceSchema = z.object({
  member_id: z
    .string({ required_error: "ID anggota wajib diisi." })
    .uuid("ID anggota harus berformat UUID yang valid."),
  schedule_id: z
    .string({ required_error: "ID jadwal sesi wajib diisi." })
    .uuid("ID jadwal sesi harus berformat UUID yang valid."),
  status: z.enum(
    [
      AttendanceStatus.HADIR,
      AttendanceStatus.TERLAMBAT,
      AttendanceStatus.IZIN,
      AttendanceStatus.SAKIT,
    ],
    {
      errorMap: () => ({
        message:
          "Status absensi manual hanya boleh: HADIR, TERLAMBAT, IZIN, atau SAKIT. Status ALPA hanya dapat ditetapkan melalui rekonsiliasi.",
      }),
    }
  ),
  method: z.nativeEnum(AttendanceMethod, {
    errorMap: () => ({
      message: "Metode absensi harus RFID atau MANUAL.",
    }),
  }),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

/**
 * Skema validasi untuk koreksi status absensi (HISTORY_CORRECTION).
 * Wajib menyertakan alasan minimal 10 karakter.
 */
export const updateAttendanceSchema = z.object({
  status: z.nativeEnum(AttendanceStatus, {
    errorMap: () => ({
      message:
        "Status absensi harus salah satu dari: HADIR, TERLAMBAT, IZIN, SAKIT, ALPA.",
    }),
  }),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  reason: z
    .string({ required_error: "Alasan koreksi wajib diisi." })
    .trim()
    .min(10, "Alasan koreksi minimal 10 karakter."),
});

/**
 * Skema validasi untuk query/filter daftar absensi.
 */
export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  schedule_id: z.string().uuid().optional(),
  activity_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
    .optional(),
  sort_by: z
    .enum(["scan_time", "created_at", "status"])
    .default("scan_time"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type RfidScanInput = z.infer<typeof rfidScanSchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;
