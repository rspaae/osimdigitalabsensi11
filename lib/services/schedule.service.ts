import { prisma } from "@/lib/db/prisma";
import { Prisma, ScheduleStatus } from "@prisma/client";
import {
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleQueryInput,
} from "@/lib/validators/schedule.schema";
import {
  parseDateOnlyToUtc,
  parseWibToUtc,
} from "@/lib/utils/timezone";
import {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} from "./errors";

/**
 * Validasi urutan kronologis waktu sesi:
 * start_time < late_threshold < end_time
 */
export function validateChronologicalOrder(
  startTime: Date,
  lateThreshold: Date,
  endTime: Date
) {
  if (startTime.getTime() >= lateThreshold.getTime()) {
    throw new ValidationError(
      "Waktu mulai (start_time) harus lebih awal daripada batas terlambat (late_threshold)."
    );
  }

  if (lateThreshold.getTime() >= endTime.getTime()) {
    throw new ValidationError(
      "Batas waktu terlambat (late_threshold) harus lebih awal daripada waktu selesai sesi (end_time)."
    );
  }
}

/**
 * Validasi transisi status sesi absensi (State Machine):
 * DRAFT -> OPEN (Sesi dibuka untuk pemindaian presensi)
 * DRAFT -> CLOSED (Sesi dibatalkan tanpa presensi)
 * OPEN  -> CLOSED (Sesi ditutup, siap untuk rekonsiliasi ALPA)
 * CLOSED -> [TIDAK BOLEH BERUBAH] (Status terkunci demi integritas audit & absensi)
 */
export function validateStatusTransition(
  currentStatus: ScheduleStatus,
  targetStatus: ScheduleStatus
) {
  if (currentStatus === targetStatus) {
    return;
  }

  if (currentStatus === ScheduleStatus.CLOSED) {
    throw new BusinessRuleError(
      "Sesi yang telah ditutup (CLOSED) terkunci dan tidak dapat dibuka atau diubah statusnya kembali."
    );
  }

  if (currentStatus === ScheduleStatus.DRAFT) {
    if (targetStatus === ScheduleStatus.OPEN || targetStatus === ScheduleStatus.CLOSED) {
      return;
    }
  }

  if (currentStatus === ScheduleStatus.OPEN) {
    if (targetStatus === ScheduleStatus.CLOSED) {
      return;
    }
    if (targetStatus === ScheduleStatus.DRAFT) {
      throw new BusinessRuleError(
        "Sesi yang sedang berjalan (OPEN) tidak dapat dikembalikan ke status DRAFT."
      );
    }
  }

  throw new BusinessRuleError(
    `Transisi status sesi dari '${currentStatus}' ke '${targetStatus}' tidak diizinkan.`
  );
}

export async function getSchedules(query: ScheduleQueryInput) {
  const {
    page = 1,
    limit = 10,
    activity_id,
    date,
    status,
    sort_by = "date",
    sort_order = "desc",
  } = query;

  const skip = (page - 1) * limit;
  const where: Prisma.ActivityScheduleWhereInput = {};

  if (activity_id) {
    where.activity_id = activity_id;
  }

  if (status) {
    where.status = status;
  }

  if (date) {
    where.date = parseDateOnlyToUtc(date);
  }

  const [total, schedules] = await Promise.all([
    prisma.activitySchedule.count({ where }),
    prisma.activitySchedule.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ [sort_by]: sort_order }, { created_at: "desc" }],
      include: {
        activity: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            default_late_threshold_minutes: true,
          },
        },
        device: {
          select: {
            id: true,
            device_code: true,
            name: true,
            location: true,
            is_active: true,
          },
        },
        _count: {
          select: { attendances: true },
        },
      },
    }),
  ]);

  const total_pages = Math.ceil(total / limit);

  return {
    schedules,
    pagination: {
      page,
      limit,
      total,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    },
  };
}

export async function getScheduleById(id: string) {
  const schedule = await prisma.activitySchedule.findUnique({
    where: { id },
    include: {
      activity: true,
      device: true,
      attendances: {
        take: 20,
        orderBy: { scan_time: "desc" },
        include: {
          member: {
            select: {
              id: true,
              nis: true,
              full_name: true,
              class_grade: true,
              organization_type: true,
            },
          },
        },
      },
      _count: {
        select: { attendances: true },
      },
    },
  });

  if (!schedule) {
    throw new NotFoundError(`Jadwal sesi kegiatan dengan ID '${id}' tidak ditemukan.`);
  }

  return schedule;
}

export async function createSchedule(input: CreateScheduleInput) {
  // 1. Verifikasi kegiatan induk ada dan aktif
  const activity = await prisma.activity.findUnique({
    where: { id: input.activity_id },
  });
  if (!activity) {
    throw new NotFoundError(
      `Kegiatan dengan ID '${input.activity_id}' tidak ditemukan.`
    );
  }
  if (!activity.is_active) {
    throw new BusinessRuleError(
      `Kegiatan '${activity.name}' saat ini nonaktif dan tidak dapat dibuatkan sesi jadwal baru.`
    );
  }

  // 2. Verifikasi perangkat scanner jika disertakan
  if (input.device_id) {
    const device = await prisma.device.findUnique({
      where: { id: input.device_id },
    });
    if (!device) {
      throw new NotFoundError(
        `Perangkat dengan ID '${input.device_id}' tidak ditemukan.`
      );
    }
  }

  // 3. Konversi format waktu WIB ke UTC PostgreSQL DATE & TIMESTAMPTZ
  const dateUtc = parseDateOnlyToUtc(input.date);
  const startTimeUtc = parseWibToUtc(input.start_time, input.date);
  const lateThresholdUtc = parseWibToUtc(input.late_threshold, input.date);
  const endTimeUtc = parseWibToUtc(input.end_time, input.date);

  // 4. Validasi urutan waktu kronologis (start < late < end)
  validateChronologicalOrder(startTimeUtc, lateThresholdUtc, endTimeUtc);

  // 5. Simpan record jadwal sesi kegiatan
  return prisma.activitySchedule.create({
    data: {
      activity_id: input.activity_id,
      device_id: input.device_id,
      title: input.title,
      date: dateUtc,
      start_time: startTimeUtc,
      late_threshold: lateThresholdUtc,
      end_time: endTimeUtc,
      status: input.status,
    },
    include: {
      activity: true,
      device: true,
    },
  });
}

export async function updateSchedule(id: string, input: UpdateScheduleInput) {
  const current = await prisma.activitySchedule.findUnique({
    where: { id },
  });
  if (!current) {
    throw new NotFoundError(`Jadwal sesi dengan ID '${id}' tidak ditemukan.`);
  }

  // 1. Validasi transisi status jika status diubah
  if (input.status && input.status !== current.status) {
    validateStatusTransition(current.status, input.status);
  }

  // 2. Verifikasi perangkat jika diubah
  if (input.device_id) {
    const device = await prisma.device.findUnique({
      where: { id: input.device_id },
    });
    if (!device) {
      throw new NotFoundError(
        `Perangkat dengan ID '${input.device_id}' tidak ditemukan.`
      );
    }
  }

  // 3. Penyesuaian waktu dan tanggal jika ada perubahan
  const baseDateStr = input.date ?? current.date.toISOString().split("T")[0];
  const dateUtc = input.date ? parseDateOnlyToUtc(input.date) : current.date;
  const startTimeUtc = input.start_time
    ? parseWibToUtc(input.start_time, baseDateStr)
    : current.start_time;
  const lateThresholdUtc = input.late_threshold
    ? parseWibToUtc(input.late_threshold, baseDateStr)
    : current.late_threshold;
  const endTimeUtc = input.end_time
    ? parseWibToUtc(input.end_time, baseDateStr)
    : current.end_time;

  // 4. Validasi kronologis jika waktu diubah
  validateChronologicalOrder(startTimeUtc, lateThresholdUtc, endTimeUtc);

  return prisma.activitySchedule.update({
    where: { id },
    data: {
      device_id: input.device_id !== undefined ? input.device_id : current.device_id,
      title: input.title !== undefined ? input.title : current.title,
      date: dateUtc,
      start_time: startTimeUtc,
      late_threshold: lateThresholdUtc,
      end_time: endTimeUtc,
      status: input.status ?? current.status,
    },
    include: {
      activity: true,
      device: true,
    },
  });
}

export async function deleteSchedule(id: string) {
  const current = await prisma.activitySchedule.findUnique({
    where: { id },
    include: {
      _count: { select: { attendances: true } },
    },
  });

  if (!current) {
    throw new NotFoundError(`Jadwal sesi dengan ID '${id}' tidak ditemukan.`);
  }

  // Kebijakan Integritas: Jangan pernah menghapus jadwal yang memiliki riwayat absensi
  if (current._count.attendances > 0) {
    throw new BusinessRuleError(
      `Jadwal sesi tidak dapat dihapus karena telah memiliki ${current._count.attendances} data absensi anggota. Tutup sesi dengan mengubah status menjadi CLOSED.`
    );
  }

  await prisma.activitySchedule.delete({ where: { id } });
  return {
    success: true,
    message: "Jadwal sesi kegiatan berhasil dihapus.",
  };
}
