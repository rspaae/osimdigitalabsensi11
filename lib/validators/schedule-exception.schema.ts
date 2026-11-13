import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createScheduleExceptionSchema = z
  .object({
    date: z
      .string({ required_error: "Tanggal wajib diisi." })
      .regex(ISO_DATE, "Format tanggal harus YYYY-MM-DD."),
    end_date: z
      .string()
      .regex(ISO_DATE, "Format tanggal akhir harus YYYY-MM-DD.")
      .optional()
      .nullable(),
    activity_id: z
      .string()
      .uuid("ID kegiatan tidak valid")
      .optional()
      .nullable(),
    reason: z
      .string({ required_error: "Alasan wajib diisi." })
      .trim()
      .min(5, "Alasan minimal 5 karakter.")
      .max(200, "Alasan maksimal 200 karakter."),
  })
  .refine((value) => !value.end_date || value.end_date >= value.date, {
    message: "Tanggal akhir tidak boleh sebelum tanggal awal.",
    path: ["end_date"],
  });

export type CreateScheduleExceptionInput = z.infer<typeof createScheduleExceptionSchema>;

export const scheduleExceptionQuerySchema = z.object({
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
});
