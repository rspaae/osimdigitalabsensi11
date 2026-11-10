import { prisma } from "@/lib/db/prisma";
import {
  Prisma,
  AttendanceStatus,
  AttendanceMethod,
  ScheduleStatus,
  SubstitutionStatus,
} from "@prisma/client";
import { authenticateDevice } from "./device-auth.service";
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "./errors";
import {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AttendanceQueryInput,
} from "@/lib/validators/attendance.schema";
import { parseDateOnlyToUtc, parseWibToUtc } from "@/lib/utils/timezone";
import { normalizeRfidUid } from "@/lib/utils/rfid";
import {
  getWibDateComponents,
  calculateCycleWeek,
} from "@/lib/utils/duty-cycle";

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutesToAdd;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

// ============================================================================
// RFID SCAN (PUBLIC — perangkat IoT)
// ============================================================================

/**
 * Merekam absensi dari pemindaian RFID perangkat ESP32 secara otomatis.
 * Waktu server Asia/Jakarta digunakan — timestamp dari ESP32 TIDAK dipercaya.
 * Tanpa perlu open/close sesi manual.
 * Menggunakan evaluasi siklus 14 hari (WEEK_1 & WEEK_2) dan cutoff piket:
 * - Sapa Pagi: cutoff 06:00 WIB
 * - Danusan: cutoff 06:10 WIB
 * - On/before cutoff: HADIR (roster/substitusi) atau DI_LUAR_JADWAL (non-roster)
 * - Melebihi cutoff: CUTOFF_TIME_EXCEEDED (tidak ada record dibuat, tidak ada TERLAMBAT)
 * - Idempoten: jika sudah scan, kembalikan record awal dengan is_duplicate: true.
 *
 * @param deviceCode - Kode perangkat dari body request
 * @param rawApiKey  - Raw API key dari header Authorization: Bearer <key>
 * @param rfidUid    - UID kartu RFID yang dipindai (akan dinormalisasi)
 * @param simulatedNow - Waktu simulasi opsional untuk pengujian unit
 */
export async function recordRfidAttendance(
  deviceCode: string,
  rawApiKey: string,
  rfidUid: string,
  simulatedNow?: Date
) {
  // 1. Normalisasi UID ke format kanonikal heksadesimal uppercase
  const normalizedUid = normalizeRfidUid(rfidUid);

  // 2. Autentikasi perangkat — dapatkan device beserta device_id-nya
  const device = await authenticateDevice(deviceCode, rawApiKey);

  // 3. Cari anggota berdasarkan rfid_uid kanonikal
  const member = await prisma.member.findUnique({
    where: { rfid_uid: normalizedUid },
    select: { id: true, full_name: true, status: true },
  });

  if (!member) {
    throw new NotFoundError(
      "Anggota dengan UID RFID ini tidak ditemukan.",
      "MEMBER_NOT_FOUND"
    );
  }

  if (member.status === "INACTIVE") {
    throw new NotFoundError(
      "Anggota ini terdaftar namun berstatus tidak aktif.",
      "MEMBER_INACTIVE"
    );
  }

  // 4. Evaluasi waktu server dalam zona WIB (Asia/Jakarta)
  const now = simulatedNow ?? new Date();
  const { dateStr, timeStr, dayOfWeek } = getWibDateComponents(now);

  // Ambil tanggal mulai siklus dari SystemSetting
  const cycleSetting = await prisma.systemSetting.findUnique({
    where: { key: "cycle_start_date" },
  });

  if (!cycleSetting || !cycleSetting.value) {
    throw new BusinessRuleError(
      "Siklus jadwal belum dikonfigurasi. Hubungi Superadmin.",
      "CYCLE_NOT_CONFIGURED"
    );
  }

  const { cycleWeek } = calculateCycleWeek(now, cycleSetting.value);

  // 5. Cari jadwal piket (DutySchedule) yang aktif untuk cycle_week dan day_of_week hari ini
  const todayDutySchedules = await prisma.dutySchedule.findMany({
    where: {
      cycle_week: cycleWeek,
      day_of_week: dayOfWeek,
      is_active: true,
    },
    include: {
      activity: true,
      roster_members: true,
    },
  });

  // Tentukan jadwal yang sedang berada dalam sesi (dimulai dari start_time hingga grace period 30 menit setelah cutoff)
  const matchingSchedules = todayDutySchedules.filter((schedule) => {
    const sessionEndWib = addMinutesToTime(schedule.cutoff_time_wib, 30);
    return timeStr >= schedule.start_time_wib && timeStr <= sessionEndWib;
  });

  if (matchingSchedules.length === 0) {
    throw new BusinessRuleError(
      "Tidak ada jadwal piket yang sedang berlangsung saat ini.",
      "SCHEDULE_NO_MATCH"
    );
  }

  const todayUtcMidnight = parseDateOnlyToUtc(dateStr);

  // Ambil substitusi yang disetujui untuk member hari ini pada jadwal yang sedang aktif
  const activeSubs = await prisma.dutySubstitution.findMany({
    where: {
      duty_date: todayUtcMidnight,
      substitute_member_id: member.id,
      status: SubstitutionStatus.APPROVED,
      duty_schedule_id: { in: matchingSchedules.map((s) => s.id) },
    },
  });
  const activeSubScheduleIds = new Set(
    activeSubs.map((s) => s.duty_schedule_id)
  );

  // Cari jadwal di mana anggota terjadwal (melalui roster ATAU substitusi resmi)
  const rosteredSchedules = matchingSchedules.filter(
    (s) =>
      s.roster_members.some((r) => r.member_id === member.id) ||
      activeSubScheduleIds.has(s.id)
  );

  // Tentukan jadwal target yang akan diproses absensinya
  interface TargetDutyScheduleItem {
    dutySchedule: (typeof matchingSchedules)[0];
    isSubstitution: boolean;
    status: AttendanceStatus;
  }
  let schedulesToRecord: TargetDutyScheduleItem[] = [];

  if (rosteredSchedules.length > 0) {
    // Validasi ambiguitas jika ada lebih dari 1 jadwal untuk AKTIVITAS YANG SAMA
    const activityCodes = rosteredSchedules.map((s) => s.activity.code);
    if (new Set(activityCodes).size !== activityCodes.length) {
      throw new BusinessRuleError(
        "Terdapat jadwal ganda yang bentrok untuk kegiatan yang sama pada waktu ini.",
        "SCHEDULE_AMBIGUOUS"
      );
    }

    // Anggota bertugas di satu atau lebih kegiatan simultan (misal Sapa Pagi dan/atau Danusan)
    schedulesToRecord = rosteredSchedules.map((dutySchedule) => ({
      dutySchedule,
      isSubstitution: activeSubScheduleIds.has(dutySchedule.id),
      status: AttendanceStatus.HADIR,
    }));
  } else {
    // Anggota TIDAK terdaftar di roster kegiatan manapun hari ini -> DI_LUAR_JADWAL
    // Pilih jadwal utama (prioritas SAPA_PAGI jika ada, selain itu jadwal pertama)
    const sapaPagiSchedule = matchingSchedules.find(
      (s) => s.activity.code === "SAPA_PAGI"
    );
    const targetDutySchedule = sapaPagiSchedule ?? matchingSchedules[0];

    // Jika ada beberapa jadwal yang cocok untuk kegiatan yang sama tanpa pembeda roster:
    const sameActivitySchedules = matchingSchedules.filter(
      (s) => s.activity.code === targetDutySchedule.activity.code
    );
    if (sameActivitySchedules.length > 1) {
      throw new BusinessRuleError(
        "Terdapat lebih dari satu jadwal piket aktif yang ambigu untuk waktu saat ini.",
        "SCHEDULE_AMBIGUOUS"
      );
    }

    schedulesToRecord = [
      {
        dutySchedule: targetDutySchedule,
        isSubstitution: false,
        status: AttendanceStatus.DI_LUAR_JADWAL,
      },
    ];
  }

  // 6. Evaluasi Batas Waktu (Cutoff Time):
  // Jika scan melewati cutoff_time_wib pada jadwal target, tolak scan tanpa membuat catatan absensi.
  // CATATAN: Status TERLAMBAT TIDAK MUNGKIN terjadi dalam alur absensi otomatis ini.
  // Scan yang melewati batas langsung DITOLAK (BusinessRuleError).
  for (const item of schedulesToRecord) {
    if (timeStr > item.dutySchedule.cutoff_time_wib) {
      throw new BusinessRuleError(
        `Batas waktu absensi (${item.dutySchedule.cutoff_time_wib} WIB) telah berakhir. Absensi ditolak.`,
        "CUTOFF_TIME_EXCEEDED"
      );
    }
  }

  // 7. Proses pencatatan absensi untuk setiap jadwal target (bisa mencatat Sapa Pagi dan Danusan sekaligus)
  interface ProcessedAttendanceResult {
    id: string;
    status: AttendanceStatus;
    scan_time: Date;
    schedule_id: string;
    duty_schedule_id: string;
    activity_name: string;
    is_substitution: boolean;
    is_duplicate: boolean;
  }
  const processedResults: ProcessedAttendanceResult[] = [];

  for (const item of schedulesToRecord) {
    const { dutySchedule, isSubstitution, status } = item;

    // Cari atau buat ActivitySchedule hari ini
    let activitySchedule = await prisma.activitySchedule.findFirst({
      where: {
        activity_id: dutySchedule.activity_id,
        date: todayUtcMidnight,
      },
    });

    if (!activitySchedule) {
      const startTimeUtc = parseWibToUtc(dutySchedule.start_time_wib, dateStr);
      const cutoffTimeUtc = parseWibToUtc(dutySchedule.cutoff_time_wib, dateStr);
      const sessionEndTimeUtc = parseWibToUtc(
        addMinutesToTime(dutySchedule.cutoff_time_wib, 30),
        dateStr
      );

      activitySchedule = await prisma.activitySchedule.create({
        data: {
          activity_id: dutySchedule.activity_id,
          device_id: device.id,
          title:
            dutySchedule.title ?? `${dutySchedule.activity.name} - ${dateStr}`,
          date: todayUtcMidnight,
          start_time: startTimeUtc,
          late_threshold: cutoffTimeUtc,
          end_time: sessionEndTimeUtc,
          status: ScheduleStatus.OPEN,
        },
      });
    }

    // Cek idempotensi: Apakah anggota sudah scan untuk schedule_id ini
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        member_id_schedule_id: {
          member_id: member.id,
          schedule_id: activitySchedule.id,
        },
      },
    });

    if (existingAttendance) {
      processedResults.push({
        id: existingAttendance.id,
        status: existingAttendance.status,
        scan_time: existingAttendance.scan_time,
        schedule_id: activitySchedule.id,
        duty_schedule_id: existingAttendance.duty_schedule_id ?? dutySchedule.id,
        activity_name: dutySchedule.activity.name,
        is_substitution: existingAttendance.is_substitution,
        is_duplicate: true,
      });
      continue;
    }

    // Catat record absensi baru
    try {
      const attendance = await prisma.attendance.create({
        data: {
          member_id: member.id,
          schedule_id: activitySchedule.id,
          duty_schedule_id: dutySchedule.id,
          is_substitution: isSubstitution,
          scan_time: now,
          status,
          method: AttendanceMethod.RFID,
        },
      });

      processedResults.push({
        id: attendance.id,
        status: attendance.status,
        scan_time: attendance.scan_time,
        schedule_id: activitySchedule.id,
        duty_schedule_id: dutySchedule.id,
        activity_name: dutySchedule.activity.name,
        is_substitution: isSubstitution,
        is_duplicate: false,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await prisma.attendance.findUnique({
          where: {
            member_id_schedule_id: {
              member_id: member.id,
              schedule_id: activitySchedule.id,
            },
          },
        });

        if (!existing) {
          throw new ConflictError("Konflik data absensi yang tidak terduga.");
        }

        processedResults.push({
          id: existing.id,
          status: existing.status,
          scan_time: existing.scan_time,
          schedule_id: activitySchedule.id,
          duty_schedule_id: existing.duty_schedule_id ?? dutySchedule.id,
          activity_name: dutySchedule.activity.name,
          is_substitution: existing.is_substitution,
          is_duplicate: true,
        });
      } else {
        throw error;
      }
    }
  }

  // Ambil record primer untuk respons firmware
  const primaryResult = processedResults[0];

  return {
    attendance_id: primaryResult.id,
    member_name: member.full_name,
    member_id: member.id,
    status: primaryResult.status,
    scan_time: primaryResult.scan_time,
    schedule_id: primaryResult.schedule_id,
    duty_schedule_id: primaryResult.duty_schedule_id,
    is_substitution: primaryResult.is_substitution,
    is_duplicate: primaryResult.is_duplicate,
    activity_names: processedResults.map((r) => r.activity_name),
  };
}

// ============================================================================
// MANUAL ATTENDANCE CREATION
// ============================================================================

/**
 * Membuat absensi secara manual oleh Admin.
 * ALPA tidak diizinkan — hanya melalui rekonsiliasi.
 */
export async function createManualAttendance(
  input: CreateAttendanceInput,
  actingUserId: string
) {
  // actingUserId reserved for future audit extensions
  void actingUserId;

  // 1. Reject ALPA
  if ((input.status as string) === AttendanceStatus.ALPA) {
    throw new BusinessRuleError(
      "Status ALPA tidak dapat dibuat secara manual. Gunakan fitur rekonsiliasi pada sesi yang sudah CLOSED."
    );
  }

  // 2. Validasi schedule
  const schedule = await prisma.activitySchedule.findUnique({
    where: { id: input.schedule_id },
    select: { id: true, status: true },
  });

  if (!schedule) {
    throw new NotFoundError(
      `Jadwal sesi dengan ID '${input.schedule_id}' tidak ditemukan.`
    );
  }

  // HADIR/TERLAMBAT hanya untuk sesi OPEN; IZIN/SAKIT untuk sesi tidak DRAFT
  if (
    input.status === AttendanceStatus.HADIR ||
    input.status === AttendanceStatus.TERLAMBAT
  ) {
    if (schedule.status !== ScheduleStatus.OPEN) {
      throw new BusinessRuleError(
        "Status HADIR atau TERLAMBAT hanya dapat diinput pada sesi yang berstatus OPEN."
      );
    }
  } else {
    // IZIN atau SAKIT
    if (schedule.status === ScheduleStatus.DRAFT) {
      throw new BusinessRuleError(
        "Status IZIN atau SAKIT tidak dapat diinput pada sesi yang masih berstatus DRAFT."
      );
    }
  }

  // 3. Validasi member aktif
  const member = await prisma.member.findUnique({
    where: { id: input.member_id },
    select: { id: true, full_name: true, status: true },
  });

  if (!member || member.status === "INACTIVE") {
    throw new NotFoundError(
      `Anggota dengan ID '${input.member_id}' tidak ditemukan atau sudah tidak aktif.`
    );
  }

  // 4. Buat absensi (tangkap P2002 → ConflictError)
  try {
    const attendance = await prisma.attendance.create({
      data: {
        member_id: input.member_id,
        schedule_id: input.schedule_id,
        status: input.status,
        method: input.method,
        notes: input.notes ?? null,
        scan_time: new Date(),
      },
      include: {
        member: { select: { id: true, full_name: true, nis: true } },
        schedule: {
          select: {
            id: true,
            date: true,
            activity: { select: { id: true, name: true } },
          },
        },
      },
    });

    return attendance;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        `Anggota '${member.full_name}' sudah memiliki data absensi pada sesi ini.`
      );
    }
    throw error;
  }
}

// ============================================================================
// ATTENDANCE CORRECTION
// ============================================================================

/**
 * Mengoreksi status absensi yang sudah ada.
 * Wajib menyertakan alasan dan mencatat AuditLog secara atomik.
 */
export async function correctAttendance(
  attendanceId: string,
  input: UpdateAttendanceInput,
  actingUserId: string
) {
  // 1. Load existing attendance
  const existing = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, status: true, notes: true },
  });

  if (!existing) {
    throw new NotFoundError(
      `Data absensi dengan ID '${attendanceId}' tidak ditemukan.`
    );
  }

  // 2. Guard reason length (Zod sudah memvalidasi, ini double-check)
  if (!input.reason || input.reason.trim().length < 10) {
    throw new BusinessRuleError(
      "Alasan koreksi wajib diisi dan minimal 10 karakter."
    );
  }

  const oldValues = { status: existing.status, notes: existing.notes };
  const newValues = { status: input.status, notes: input.notes ?? null };

  // 3. Update + AuditLog dalam satu transaksi
  const [updatedAttendance] = await prisma.$transaction([
    prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: input.status,
        notes: input.notes ?? null,
        updated_at: new Date(),
      },
      include: {
        member: { select: { id: true, full_name: true, nis: true } },
        schedule: {
          select: {
            id: true,
            date: true,
            activity: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.auditLog.create({
      data: {
        user_id: actingUserId,
        action: "CORRECT_ATTENDANCE",
        entity_type: "attendance",
        entity_id: attendanceId,
        old_values: oldValues,
        new_values: newValues,
        reason: input.reason,
      },
    }),
  ]);

  return updatedAttendance;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Daftar absensi dengan filter dan paginasi.
 */
export async function getAttendances(query: AttendanceQueryInput) {
  const {
    page = 1,
    limit = 10,
    schedule_id,
    activity_id,
    member_id,
    status,
    date,
    sort_by = "scan_time",
    sort_order = "desc",
  } = query;

  const skip = (page - 1) * limit;
  const where: Prisma.AttendanceWhereInput = {};

  if (schedule_id) where.schedule_id = schedule_id;
  if (member_id) where.member_id = member_id;
  if (status) where.status = status;

  // Filter berdasarkan activity_id atau date (melalui relasi schedule)
  if (activity_id || date) {
    const scheduleFilter: Prisma.ActivityScheduleWhereInput = {};
    if (activity_id) scheduleFilter.activity_id = activity_id;
    if (date) {
      const dayStart = parseDateOnlyToUtc(date);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      scheduleFilter.date = { gte: dayStart, lt: dayEnd };
    }
    where.schedule = scheduleFilter;
  }

  const [total, attendances] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort_by]: sort_order },
      include: {
        member: { select: { id: true, full_name: true, nis: true } },
        schedule: {
          select: {
            id: true,
            date: true,
            activity: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const total_pages = Math.ceil(total / limit);

  return {
    attendances,
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

/**
 * Detail satu record absensi berdasarkan ID.
 */
export async function getAttendanceById(id: string) {
  const attendance = await prisma.attendance.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, full_name: true, nis: true } },
      schedule: {
        select: {
          id: true,
          date: true,
          start_time: true,
          late_threshold: true,
          end_time: true,
          status: true,
          activity: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!attendance) {
    throw new NotFoundError(
      `Data absensi dengan ID '${id}' tidak ditemukan.`
    );
  }

  return attendance;
}

/**
 * Semua absensi untuk satu jadwal sesi, diurutkan berdasarkan nama anggota.
 */
export async function getScheduleAttendance(scheduleId: string) {
  // Validasi schedule ada
  const schedule = await prisma.activitySchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      date: true,
      status: true,
      activity: { select: { id: true, name: true } },
      _count: { select: { attendances: true } },
    },
  });

  if (!schedule) {
    throw new NotFoundError(
      `Jadwal sesi dengan ID '${scheduleId}' tidak ditemukan.`
    );
  }

  const attendances = await prisma.attendance.findMany({
    where: { schedule_id: scheduleId },
    include: {
      member: { select: { id: true, full_name: true, nis: true, status: true } },
    },
    orderBy: { member: { full_name: "asc" } },
  });

  return { schedule, attendances };
}

// ============================================================================
// RECONCILIATION
// ============================================================================

/**
 * Rekonsiliasi jadwal CLOSED: buat ALPA untuk anggota aktif yang belum hadir.
 * Idempoten — anggota yang sudah punya record dilewati.
 */
export async function reconcileSchedule(
  scheduleId: string,
  actingUserId: string
) {
  // actingUserId reserved for future audit extensions
  void actingUserId;

  // 1. Load schedule — harus CLOSED
  const schedule = await prisma.activitySchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, status: true },
  });

  if (!schedule) {
    throw new NotFoundError(
      `Jadwal sesi dengan ID '${scheduleId}' tidak ditemukan.`
    );
  }

  if (schedule.status !== ScheduleStatus.CLOSED) {
    throw new BusinessRuleError(
      "Rekonsiliasi hanya dapat dilakukan pada sesi yang sudah CLOSED."
    );
  }

  // 2. Semua anggota aktif (bukan INACTIVE)
  const allActiveMembers = await prisma.member.findMany({
    where: { status: { not: "INACTIVE" } },
    select: { id: true },
  });

  // 3. Anggota yang sudah punya record di sesi ini
  const existingAttendances = await prisma.attendance.findMany({
    where: { schedule_id: scheduleId },
    select: { member_id: true },
  });

  const attendedMemberIds = new Set(existingAttendances.map((a) => a.member_id));

  // 4. Set difference → buat ALPA
  const membersNeedingAlpa = allActiveMembers.filter(
    (m) => !attendedMemberIds.has(m.id)
  );

  if (membersNeedingAlpa.length > 0) {
    await prisma.$transaction(
      membersNeedingAlpa.map((m) =>
        prisma.attendance.create({
          data: {
            member_id: m.id,
            schedule_id: scheduleId,
            status: AttendanceStatus.ALPA,
            method: AttendanceMethod.MANUAL,
            notes: "Dibuat otomatis oleh sistem rekonsiliasi.",
          },
        })
      )
    );
  }

  return {
    created: membersNeedingAlpa.length,
    skipped: attendedMemberIds.size,
    total_members: allActiveMembers.length,
  };
}
