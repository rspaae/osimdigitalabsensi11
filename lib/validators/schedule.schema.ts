import { z } from "zod";
import { ScheduleStatus } from "@prisma/client";

export const createScheduleSchema = z.object({
  activity_id: z
    .string({ required_error: "ID Kegiatan (activity_id) wajib diisi." })
    .uuid("ID Kegiatan harus berformat UUID."),
  device_id: z
    .string()
    .uuid("ID Perangkat harus berformat UUID.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  title: z
    .string()
    .trim()
    .max(100, "Judul jadwal sesi maksimal 100 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  date: z
    .string({ required_error: "Tanggal jadwal (date) wajib diisi." })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD (contoh: 2026-11-08)."),
  start_time: z
    .string({ required_error: "Waktu mulai sesi (start_time) wajib diisi." })
    .trim(),
  late_threshold: z
    .string({ required_error: "Ambang batas waktu terlambat (late_threshold) wajib diisi." })
    .trim(),
  end_time: z
    .string({ required_error: "Waktu penutupan sesi (end_time) wajib diisi." })
    .trim(),
  status: z
    .nativeEnum(ScheduleStatus, {
      errorMap: () => ({ message: "Status jadwal harus DRAFT, OPEN, atau CLOSED." }),
    })
    .default(ScheduleStatus.DRAFT),
});

export const updateScheduleSchema = z.object({
  device_id: z
    .string()
    .uuid("ID Perangkat harus berformat UUID.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  title: z
    .string()
    .trim()
    .max(100, "Judul jadwal sesi maksimal 100 karakter.")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
    .optional(),
  start_time: z.string().trim().optional(),
  late_threshold: z.string().trim().optional(),
  end_time: z.string().trim().optional(),
  status: z
    .nativeEnum(ScheduleStatus, {
      errorMap: () => ({ message: "Status jadwal harus DRAFT, OPEN, atau CLOSED." }),
    })
    .optional(),
});

export const scheduleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  activity_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(ScheduleStatus).optional(),
  sort_by: z.enum(["date", "start_time", "created_at"]).default("date"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ScheduleQueryInput = z.infer<typeof scheduleQuerySchema>;
