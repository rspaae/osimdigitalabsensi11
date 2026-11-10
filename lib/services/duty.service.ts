import { prisma } from "@/lib/db/prisma";
import {
  CycleWeek,
  DayOfWeek,
  SubstitutionStatus,
  Prisma,
} from "@prisma/client";
import {
  Role,
  type AuthenticatedUser,
} from "@/types/auth";
import { AuthorizationError } from "@/lib/auth/rbac";
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "./errors";
import {
  calculateCycleWeek,
  getWibDateComponents,
} from "@/lib/utils/duty-cycle";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import {
  CreateDutyScheduleInput,
  UpdateDutyScheduleInput,
  CreateSubstitutionInput,
  SubstitutionQueryInput,
} from "@/lib/validators/duty.schema";

const CYCLE_START_DATE_KEY = "cycle_start_date";

// ============================================================================
// CYCLE MANAGEMENT
// ============================================================================

export async function getCycleStatus(targetDate: Date = new Date()) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: CYCLE_START_DATE_KEY },
  });

  if (!setting || !setting.value) {
    return {
      configured: false,
      cycle_start_date: null,
      current_wib: getWibDateComponents(targetDate),
    };
  }

  const wibComponents = getWibDateComponents(targetDate);

  // Konfigurasi boleh mulai berlaku pada tanggal mendatang (mis. disiapkan
  // sehari sebelum siklus dimulai). Tetap laporkan configured tanpa menghitung
  // WEEK_1/WEEK_2 sebelum hari awal; alur scan sendiri tetap menolak tanggal itu.
  const cycleStartUtc = parseDateOnlyToUtc(setting.value);
  const currentUtc = parseDateOnlyToUtc(wibComponents.dateStr);
  if (currentUtc.getTime() < cycleStartUtc.getTime()) {
    return {
      configured: true,
      cycle_start_date: setting.value,
      current_wib: wibComponents,
      cycle_week: null,
      day_of_week: null,
      cycle_day: null,
      diff_days: null,
      starts_in_days: Math.floor(
        (cycleStartUtc.getTime() - currentUtc.getTime()) / 86_400_000
      ),
    };
  }

  const cycleCalculation = calculateCycleWeek(targetDate, setting.value);

  return {
    configured: true,
    cycle_start_date: setting.value,
    current_wib: wibComponents,
    cycle_week: cycleCalculation.cycleWeek,
    day_of_week: cycleCalculation.dayOfWeek,
    cycle_day: cycleCalculation.cycleDay,
    diff_days: cycleCalculation.diffDays,
  };
}

export async function setCycleStartDate(
  cycleStartDateStr: string,
  actingUser: AuthenticatedUser,
  description?: string
) {
  if (actingUser.role !== Role.SUPERADMIN) {
    throw new AuthorizationError(
      "Akses ditolak: Hanya SUPERADMIN yang berhak mengonfigurasi tanggal mulai siklus.",
      "FORBIDDEN"
    );
  }

  // Validasi format dan tanggal kalender (bukan hanya kecocokan pola).
  const [year, month, day] = cycleStartDateStr.split("-").map(Number);
  const checkedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(cycleStartDateStr) ||
    checkedDate.toISOString().slice(0, 10) !== cycleStartDateStr
  ) {
    throw new BusinessRuleError(
      "Tanggal mulai siklus harus berupa tanggal kalender valid dengan format YYYY-MM-DD.",
      "INVALID_CYCLE_START_DATE"
    );
  }
  parseDateOnlyToUtc(cycleStartDateStr);

  await prisma.$transaction(async (tx) => {
    const prev = await tx.systemSetting.findUnique({
      where: { key: CYCLE_START_DATE_KEY },
    });
    const updatedSetting = await tx.systemSetting.upsert({
      where: { key: CYCLE_START_DATE_KEY },
      create: {
        key: CYCLE_START_DATE_KEY,
        value: cycleStartDateStr,
        description: description ?? "Tanggal mulai siklus 14 hari OSIS/MPK",
      },
      update: {
        value: cycleStartDateStr,
        description: description ?? prev?.description,
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: actingUser.id,
        action: "SET_CYCLE_START_DATE",
        entity_type: "SystemSetting",
        entity_id: updatedSetting.id,
        old_values: prev ? { value: prev.value } : Prisma.DbNull,
        new_values: { value: cycleStartDateStr },
        reason: description ?? "Konfigurasi tanggal mulai siklus 14 hari",
        ip_address: "internal",
      },
    });
  });

  return getCycleStatus();
}

// ============================================================================
// PERMISSION CHECKER: SEKBID 2 (SAPA PAGI), SEKBID 6 (DANUSAN), SUPERADMIN
// ============================================================================

export async function assertDutyManagementPermission(
  actingUser: AuthenticatedUser,
  activityIdOrCode: string
) {
  if (actingUser.role === Role.SUPERADMIN) {
    return true;
  }

  // Cari aktivitas untuk memeriksa code / name
  const activity = await prisma.activity.findFirst({
    where: {
      OR: [{ id: activityIdOrCode }, { code: activityIdOrCode }],
    },
  });

  if (!activity) {
    throw new NotFoundError(
      "Aktivitas tidak ditemukan.",
      "ACTIVITY_NOT_FOUND"
    );
  }

  const isSapaPagi =
    activity.code === "SAPA_PAGI" ||
    activity.name.toLowerCase().includes("sapa pagi");
  const isDanusan =
    activity.code === "DANUSAN" ||
    activity.name.toLowerCase().includes("danusan");

  if (!isSapaPagi && !isDanusan) {
    // Hanya Superadmin yang boleh mengelola kegiatan di luar Sapa Pagi & Danusan
    throw new AuthorizationError(
      "Akses ditolak: Kegiatan ini hanya dapat dikelola oleh Superadmin.",
      "FORBIDDEN"
    );
  }

  // Pengguna harus terikat dengan profil Member yang memiliki posisi Sekbid yang relevan
  if (!actingUser.member_id) {
    throw new AuthorizationError(
      "Akses ditolak: Akun pengguna Anda tidak terikat dengan data anggota pengurus.",
      "FORBIDDEN"
    );
  }

  const activePositions = await prisma.memberPosition.findMany({
    where: {
      member_id: actingUser.member_id,
      is_active: true,
    },
    include: {
      sekbid: true,
    },
  });

  const sekbidNumbers = activePositions
    .map((p) => p.sekbid?.number)
    .filter((n): n is number => typeof n === "number");

  if (isSapaPagi && !sekbidNumbers.includes(2)) {
    throw new AuthorizationError(
      "Akses ditolak: Pengelolaan Sapa Pagi hanya diizinkan untuk Pengurus Sekbid 2 atau Superadmin.",
      "FORBIDDEN"
    );
  }

  if (isDanusan && !sekbidNumbers.includes(6)) {
    throw new AuthorizationError(
      "Akses ditolak: Pengelolaan Danusan hanya diizinkan untuk Pengurus Sekbid 6 atau Superadmin.",
      "FORBIDDEN"
    );
  }

  return true;
}

// ============================================================================
// DUTY SCHEDULE CRUD
// ============================================================================

export async function createDutySchedule(
  input: CreateDutyScheduleInput,
  actingUser: AuthenticatedUser
) {
  await assertDutyManagementPermission(actingUser, input.activity_id);

  // Periksa apakah jadwal untuk kombinasi (activity_id, cycle_week, day_of_week) sudah ada
  const existing = await prisma.dutySchedule.findUnique({
    where: {
      activity_id_cycle_week_day_of_week: {
        activity_id: input.activity_id,
        cycle_week: input.cycle_week,
        day_of_week: input.day_of_week,
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      `Jadwal piket untuk aktivitas ini pada ${input.cycle_week} hari ${input.day_of_week} sudah terdaftar.`,
      "DUTY_SCHEDULE_EXISTS"
    );
  }

  return prisma.dutySchedule.create({
    data: {
      activity_id: input.activity_id,
      cycle_week: input.cycle_week,
      day_of_week: input.day_of_week,
      start_time_wib: input.start_time_wib,
      cutoff_time_wib: input.cutoff_time_wib,
      title: input.title,
      is_active: input.is_active ?? true,
    },
    include: {
      activity: true,
      roster_members: {
        include: {
          member: true,
        },
      },
    },
  });
}

export async function getDutySchedules(filters?: {
  activity_id?: string;
  cycle_week?: CycleWeek;
  day_of_week?: DayOfWeek;
  is_active?: boolean;
}) {
  return prisma.dutySchedule.findMany({
    where: {
      ...(filters?.activity_id && { activity_id: filters.activity_id }),
      ...(filters?.cycle_week && { cycle_week: filters.cycle_week }),
      ...(filters?.day_of_week && { day_of_week: filters.day_of_week }),
      ...(filters?.is_active !== undefined && { is_active: filters.is_active }),
    },
    include: {
      activity: true,
      roster_members: {
        include: {
          member: {
            select: {
              id: true,
              full_name: true,
              nis: true,
              class_grade: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: [
      { cycle_week: "asc" },
      { day_of_week: "asc" },
      { start_time_wib: "asc" },
    ],
  });
}

export async function getDutyScheduleById(id: string) {
  const schedule = await prisma.dutySchedule.findUnique({
    where: { id },
    include: {
      activity: true,
      roster_members: {
        include: {
          member: {
            select: {
              id: true,
              full_name: true,
              nis: true,
              class_grade: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!schedule) {
    throw new NotFoundError(
      "Jadwal piket tidak ditemukan.",
      "DUTY_SCHEDULE_NOT_FOUND"
    );
  }

  return schedule;
}

export async function updateDutySchedule(
  id: string,
  input: UpdateDutyScheduleInput,
  actingUser: AuthenticatedUser
) {
  const schedule = await getDutyScheduleById(id);
  await assertDutyManagementPermission(actingUser, schedule.activity_id);

  const changesTime =
    (input.start_time_wib !== undefined &&
      input.start_time_wib !== schedule.start_time_wib) ||
    (input.cutoff_time_wib !== undefined &&
      input.cutoff_time_wib !== schedule.cutoff_time_wib);
  if (changesTime) {
    const attendanceCount = await prisma.attendance.count({
      where: { duty_schedule_id: id },
    });
    if (attendanceCount > 0) {
      throw new BusinessRuleError(
        "Jam jadwal tidak dapat diubah setelah ada riwayat absensi yang menggunakannya.",
        "DUTY_SCHEDULE_HAS_ATTENDANCE"
      );
    }
  }

  return prisma.dutySchedule.update({
    where: { id },
    data: {
      ...(input.start_time_wib && { start_time_wib: input.start_time_wib }),
      ...(input.cutoff_time_wib && { cutoff_time_wib: input.cutoff_time_wib }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    },
    include: {
      activity: true,
      roster_members: {
        include: {
          member: true,
        },
      },
    },
  });
}

export async function deleteDutySchedule(
  id: string,
  actingUser: AuthenticatedUser
) {
  const schedule = await getDutyScheduleById(id);
  await assertDutyManagementPermission(actingUser, schedule.activity_id);

  // Cek apakah ada record absensi historis yang terkait
  const attendanceCount = await prisma.attendance.count({
    where: { duty_schedule_id: id },
  });

  if (attendanceCount > 0) {
    // Nonaktifkan secara aman (soft deactivation) alih-alih menghapus data historis
    return prisma.dutySchedule.update({
      where: { id },
      data: { is_active: false },
    });
  }

  return prisma.dutySchedule.delete({
    where: { id },
  });
}

// ============================================================================
// ROSTER ASSIGNMENT
// ============================================================================

export async function assignRosterMembers(
  dutyScheduleId: string,
  memberIds: string[],
  notes: string | undefined,
  actingUser: AuthenticatedUser
) {
  const schedule = await getDutyScheduleById(dutyScheduleId);
  await assertDutyManagementPermission(actingUser, schedule.activity_id);

  // Verifikasi seluruh anggota valid dan berstatus aktif
  const members = await prisma.member.findMany({
    where: {
      id: { in: memberIds },
    },
    select: { id: true, status: true },
  });

  if (members.length !== memberIds.length) {
    throw new NotFoundError(
      "Satu atau lebih anggota dalam daftar tidak ditemukan.",
      "MEMBER_NOT_FOUND"
    );
  }

  const inactive = members.find((m) => m.status === "INACTIVE");
  if (inactive) {
    throw new BusinessRuleError(
      "Anggota tidak aktif tidak dapat ditugaskan ke dalam roster piket.",
      "INACTIVE_MEMBER_ASSIGNMENT"
    );
  }

  // Gunakan transaksi: timpa atau perbarui daftar anggota roster untuk jadwal ini
  return prisma.$transaction(async (tx) => {
    // Hapus anggota yang tidak ada di memberIds baru
    await tx.dutyRosterMember.deleteMany({
      where: {
        duty_schedule_id: dutyScheduleId,
        member_id: { notIn: memberIds },
      },
    });

    // Tambah anggota baru jika belum ada
    for (const memberId of memberIds) {
      await tx.dutyRosterMember.upsert({
        where: {
          duty_schedule_id_member_id: {
            duty_schedule_id: dutyScheduleId,
            member_id: memberId,
          },
        },
        create: {
          duty_schedule_id: dutyScheduleId,
          member_id: memberId,
          notes,
        },
        update: {
          notes: notes ?? undefined,
        },
      });
    }

    return tx.dutySchedule.findUnique({
      where: { id: dutyScheduleId },
      include: {
        activity: true,
        roster_members: {
          include: {
            member: {
              select: {
                id: true,
                full_name: true,
                nis: true,
                class_grade: true,
                status: true,
              },
            },
          },
        },
      },
    });
  });
}

/**
 * Tambahkan anggota ke roster tanpa menghapus penugasan yang sudah ada.
 * Dipakai oleh import roster resmi supaya pengulangan aman dan tidak mengubah
 * relasi roster lama.
 */
export async function addRosterMembers(
  dutyScheduleId: string,
  memberIds: string[],
  actingUser: AuthenticatedUser
) {
  const schedule = await getDutyScheduleById(dutyScheduleId);
  await assertDutyManagementPermission(actingUser, schedule.activity_id);

  const uniqueMemberIds = [...new Set(memberIds)];
  const members = await prisma.member.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true, status: true },
  });

  if (members.length !== uniqueMemberIds.length) {
    throw new NotFoundError(
      "Satu atau lebih anggota dalam daftar tidak ditemukan.",
      "MEMBER_NOT_FOUND"
    );
  }

  const nonActive = members.find((member) => member.status !== "ACTIVE");
  if (nonActive) {
    throw new BusinessRuleError(
      "Hanya anggota berstatus aktif yang dapat ditambahkan ke roster.",
      "INACTIVE_MEMBER_ASSIGNMENT"
    );
  }

  const result = await prisma.dutyRosterMember.createMany({
    data: uniqueMemberIds.map((memberId) => ({
      duty_schedule_id: dutyScheduleId,
      member_id: memberId,
    })),
    skipDuplicates: true,
  });

  return {
    added_count: result.count,
    schedule: await getDutyScheduleById(dutyScheduleId),
  };
}

// ============================================================================
// SUBSTITUTION & JADWAL TUKAR
// ============================================================================

export async function createSubstitution(
  input: CreateSubstitutionInput,
  actingUser: AuthenticatedUser
) {
  const schedule = await getDutyScheduleById(input.duty_schedule_id);
  await assertDutyManagementPermission(actingUser, schedule.activity_id);

  const dutyDateUtc = parseDateOnlyToUtc(input.duty_date);

  // 1. Validasi: Anggota asli (original_member_id) harus terdaftar di roster jadwal tersebut
  const isOriginalInRoster = schedule.roster_members.some(
    (r) => r.member_id === input.original_member_id
  );

  if (!isOriginalInRoster) {
    throw new BusinessRuleError(
      "Anggota yang digantikan tidak terdaftar dalam roster jadwal piket ini.",
      "ORIGINAL_MEMBER_NOT_IN_ROSTER"
    );
  }

  // 2. Validasi: original_member_id !== substitute_member_id
  if (input.original_member_id === input.substitute_member_id) {
    throw new BusinessRuleError(
      "Anggota pengganti tidak boleh sama dengan anggota yang digantikan.",
      "IDENTICAL_SUBSTITUTE_MEMBER"
    );
  }

  // 3. Validasi: substitute_member_id harus aktif
  const substituteMember = await prisma.member.findUnique({
    where: { id: input.substitute_member_id },
    select: { id: true, status: true },
  });

  if (!substituteMember) {
    throw new NotFoundError(
      "Anggota pengganti tidak ditemukan.",
      "SUBSTITUTE_MEMBER_NOT_FOUND"
    );
  }

  if (substituteMember.status === "INACTIVE") {
    throw new BusinessRuleError(
      "Anggota pengganti berstatus tidak aktif.",
      "INACTIVE_SUBSTITUTE_MEMBER"
    );
  }

  // 4. Validasi: substitute_member_id tidak boleh sudah terdaftar di roster jadwal yang sama
  const isSubstituteInSameRoster = schedule.roster_members.some(
    (r) => r.member_id === input.substitute_member_id
  );

  if (isSubstituteInSameRoster) {
    throw new BusinessRuleError(
      "Anggota pengganti sudah terdaftar bertugas pada jadwal piket ini.",
      "SUBSTITUTE_ALREADY_ON_DUTY"
    );
  }

  // 5. Validasi: Tidak boleh ada substitusi ganda yang masih APPROVED untuk original_member pada jadwal & tanggal yang sama
  const existingActiveSub = await prisma.dutySubstitution.findFirst({
    where: {
      duty_schedule_id: input.duty_schedule_id,
      duty_date: dutyDateUtc,
      original_member_id: input.original_member_id,
      status: SubstitutionStatus.APPROVED,
    },
  });

  if (existingActiveSub) {
    throw new ConflictError(
      "Sudah ada substitusi aktif untuk anggota ini pada jadwal dan tanggal yang sama.",
      "SUBSTITUTION_ALREADY_EXISTS"
    );
  }

  // 6. Validasi: Anggota pengganti tidak boleh sudah menjadi substitusi aktif di jadwal yang sama pada tanggal tersebut
  const existingSubAsSubstitute = await prisma.dutySubstitution.findFirst({
    where: {
      duty_schedule_id: input.duty_schedule_id,
      duty_date: dutyDateUtc,
      substitute_member_id: input.substitute_member_id,
      status: SubstitutionStatus.APPROVED,
    },
  });

  if (existingSubAsSubstitute) {
    throw new ConflictError(
      "Anggota pengganti sudah ditugaskan menggantikan anggota lain pada jadwal dan tanggal yang sama.",
      "SUBSTITUTE_ALREADY_ASSIGNED"
    );
  }

  const substitution = await prisma.dutySubstitution.create({
    data: {
      duty_schedule_id: input.duty_schedule_id,
      duty_date: dutyDateUtc,
      original_member_id: input.original_member_id,
      substitute_member_id: input.substitute_member_id,
      reason: input.reason,
      status: SubstitutionStatus.APPROVED,
      created_by: actingUser.id,
    },
    include: {
      duty_schedule: {
        include: { activity: true },
      },
      original_member: {
        select: { id: true, full_name: true, nis: true, class_grade: true },
      },
      substitute_member: {
        select: { id: true, full_name: true, nis: true, class_grade: true },
      },
      creator: {
        select: { id: true, username: true, role: true },
      },
    },
  });

  // Catat AuditLog
  await prisma.auditLog.create({
    data: {
      user_id: actingUser.id,
      action: "CREATE_DUTY_SUBSTITUTION",
      entity_type: "DutySubstitution",
      entity_id: substitution.id,
      new_values: {
        duty_schedule_id: input.duty_schedule_id,
        duty_date: input.duty_date,
        original_member_id: input.original_member_id,
        substitute_member_id: input.substitute_member_id,
      },
      reason: input.reason,
      ip_address: "internal",
    },
  });

  return substitution;
}

export async function getSubstitutions(query: SubstitutionQueryInput) {
  const where: Prisma.DutySubstitutionWhereInput = {
    ...(query.duty_schedule_id && { duty_schedule_id: query.duty_schedule_id }),
    ...(query.duty_date && { duty_date: parseDateOnlyToUtc(query.duty_date) }),
    ...(query.status && { status: query.status }),
    ...(query.original_member_id && {
      original_member_id: query.original_member_id,
    }),
    ...(query.substitute_member_id && {
      substitute_member_id: query.substitute_member_id,
    }),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, data] = await Promise.all([
    prisma.dutySubstitution.count({ where }),
    prisma.dutySubstitution.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ duty_date: "desc" }, { created_at: "desc" }],
      include: {
        duty_schedule: {
          include: { activity: true },
        },
        original_member: {
          select: { id: true, full_name: true, nis: true, class_grade: true },
        },
        substitute_member: {
          select: { id: true, full_name: true, nis: true, class_grade: true },
        },
        creator: {
          select: { id: true, username: true, role: true },
        },
      },
    }),
  ]);

  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: Math.ceil(total / query.limit),
    },
  };
}

export async function cancelSubstitution(
  id: string,
  actingUser: AuthenticatedUser
) {
  const sub = await prisma.dutySubstitution.findUnique({
    where: { id },
    include: {
      duty_schedule: true,
    },
  });

  if (!sub) {
    throw new NotFoundError(
      "Data substitusi tidak ditemukan.",
      "SUBSTITUTION_NOT_FOUND"
    );
  }

  await assertDutyManagementPermission(
    actingUser,
    sub.duty_schedule.activity_id
  );

  if (sub.status === SubstitutionStatus.CANCELLED) {
    return sub;
  }

  const updated = await prisma.dutySubstitution.update({
    where: { id },
    data: { status: SubstitutionStatus.CANCELLED },
  });

  // Catat AuditLog
  await prisma.auditLog.create({
    data: {
      user_id: actingUser.id,
      action: "CANCEL_DUTY_SUBSTITUTION",
      entity_type: "DutySubstitution",
      entity_id: id,
      old_values: { status: sub.status },
      new_values: { status: SubstitutionStatus.CANCELLED },
      reason: "Pembatalan substitusi jadwal piket oleh pengurus berwenang",
      ip_address: "internal",
    },
  });

  return updated;
}
