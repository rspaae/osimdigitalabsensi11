import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const setCycleStartDateSchema = z.object({
  cycle_start_date: z
    .string()
    .regex(DATE_REGEX, "Format cycle_start_date harus YYYY-MM-DD.")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.toISOString().slice(0, 10) === value;
    }, "Tanggal cycle_start_date tidak valid."),
  description: z.string().max(255).optional(),
});

export type SetCycleStartDateInput = z.infer<typeof setCycleStartDateSchema>;

export const cycleWeekEnum = z.enum(["WEEK_1", "WEEK_2"]);
export const dayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const createDutyScheduleSchema = z
  .object({
    activity_id: z.string().uuid("ID aktivitas harus berupa UUID valid."),
    cycle_week: cycleWeekEnum,
    day_of_week: dayOfWeekEnum,
    start_time_wib: z
      .string()
      .regex(TIME_REGEX, "Format start_time_wib harus HH:mm (24-jam)."),
    cutoff_time_wib: z
      .string()
      .regex(TIME_REGEX, "Format cutoff_time_wib harus HH:mm (24-jam)."),
    title: z.string().max(100).optional(),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => data.start_time_wib <= data.cutoff_time_wib,
    {
      message: "start_time_wib tidak boleh lebih besar dari cutoff_time_wib.",
      path: ["start_time_wib"],
    }
  );

export type CreateDutyScheduleInput = z.infer<typeof createDutyScheduleSchema>;

export const updateDutyScheduleSchema = z
  .object({
    start_time_wib: z
      .string()
      .regex(TIME_REGEX, "Format start_time_wib harus HH:mm (24-jam).")
      .optional(),
    cutoff_time_wib: z
      .string()
      .regex(TIME_REGEX, "Format cutoff_time_wib harus HH:mm (24-jam).")
      .optional(),
    title: z.string().max(100).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_time_wib && data.cutoff_time_wib) {
        return data.start_time_wib <= data.cutoff_time_wib;
      }
      return true;
    },
    {
      message: "start_time_wib tidak boleh lebih besar dari cutoff_time_wib.",
      path: ["start_time_wib"],
    }
  );

export type UpdateDutyScheduleInput = z.infer<typeof updateDutyScheduleSchema>;

export const assignRosterSchema = z.object({
  member_ids: z
    .array(z.string().uuid("ID anggota harus berupa UUID valid."))
    .min(1, "Daftar member_ids tidak boleh kosong."),
  notes: z.string().max(255).optional(),
});

export type AssignRosterInput = z.infer<typeof assignRosterSchema>;

export const createSubstitutionSchema = z
  .object({
    duty_schedule_id: z.string().uuid("ID duty_schedule harus berupa UUID valid."),
    duty_date: z
      .string()
      .regex(DATE_REGEX, "Format duty_date harus YYYY-MM-DD."),
    original_member_id: z
      .string()
      .uuid("ID original_member_id harus berupa UUID valid."),
    substitute_member_id: z
      .string()
      .uuid("ID substitute_member_id harus berupa UUID valid."),
    reason: z
      .string()
      .min(3, "Alasan substitusi minimal 3 karakter.")
      .max(255, "Alasan substitusi maksimal 255 karakter."),
  })
  .refine(
    (data) => data.original_member_id !== data.substitute_member_id,
    {
      message: "Anggota pengganti tidak boleh sama dengan anggota yang digantikan.",
      path: ["substitute_member_id"],
    }
  );

export type CreateSubstitutionInput = z.infer<typeof createSubstitutionSchema>;

export const substitutionQuerySchema = z.object({
  duty_schedule_id: z.string().uuid().optional(),
  duty_date: z.string().regex(DATE_REGEX).optional(),
  status: z.enum(["APPROVED", "CANCELLED"]).optional(),
  original_member_id: z.string().uuid().optional(),
  substitute_member_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SubstitutionQueryInput = z.infer<typeof substitutionQuerySchema>;
