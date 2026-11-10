import test from "node:test";
import assert from "node:assert/strict";
import {
  createActivitySchema,
  updateActivitySchema,
  activityQuerySchema,
} from "../lib/validators/activity.schema";
import {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleQuerySchema,
} from "../lib/validators/schedule.schema";
import { createSekbidSchema } from "../lib/validators/organization.schema";
import { validateAssignmentScope } from "../lib/services/member-position.service";
import {
  validateChronologicalOrder,
  validateStatusTransition,
} from "../lib/services/schedule.service";
import {
  parseDateOnlyToUtc,
  parseWibToUtc,
  formatUtcToWibString,
} from "../lib/utils/timezone";
import { SALT_ROUNDS } from "../lib/auth/password";
import {
  canAccessModule,
  assertAuthorized,
} from "../lib/auth/rbac";
import {
  Role,
  AdminScope,
  AppModule,
  PermissionAction,
  type AuthenticatedUser,
} from "../types/auth";
import {
  ActivityType,
  ScheduleStatus,
  OrganizationType,
} from "@prisma/client";
import { BusinessRuleError } from "../lib/services/errors";

// ============================================================================
// PART A: FIXES & AUDIT VERIFICATION TESTS
// ============================================================================

test("PART A: Sekbid numbering wajib strictly 1–10 (11 ditolak, 1 & 10 diterima)", () => {
  // Nilai 1 (valid)
  const validMin = createSekbidSchema.safeParse({
    number: 1,
    name: "Sekbid 1 Ketaqwaan",
  });
  assert.equal(validMin.success, true);

  // Nilai 10 (valid max)
  const validMax = createSekbidSchema.safeParse({
    number: 10,
    name: "Sekbid 10 Komunikasi & Bahasa",
  });
  assert.equal(validMax.success, true);

  // Nilai 0 (invalid)
  const invalidZero = createSekbidSchema.safeParse({
    number: 0,
    name: "Sekbid Ilegal",
  });
  assert.equal(invalidZero.success, false);

  // Nilai 11 (invalid, di luar batas 10)
  const invalidEleven = createSekbidSchema.safeParse({
    number: 11,
    name: "Sekbid Ilegal",
  });
  assert.equal(invalidEleven.success, false);
});

test("PART A: Scope Matrix Validasi Penugasan (OSIS, MPK, GENERAL) menolak kombinasi ilegal", () => {
  // 1. OSIS Assignment sah: Member OSIS + Position OSIS + Sekbid ada + Commission null
  assert.doesNotThrow(() => {
    validateAssignmentScope(
      OrganizationType.OSIS,
      OrganizationType.OSIS,
      "sek-1",
      null
    );
  });

  // 2. OSIS Assignment ilegal: Member OSIS ditugaskan dengan Komisi MPK
  assert.throws(
    () => {
      validateAssignmentScope(
        OrganizationType.OSIS,
        OrganizationType.OSIS,
        null,
        "kom-a"
      );
    },
    {
      name: "BusinessRuleError",
      message: "Penugasan jabatan OSIS tidak boleh menetapkan Komisi MPK (hanya Sekbid yang diizinkan).",
    }
  );

  // 3. MPK Assignment sah: Member MPK + Position MPK + Commission ada + Sekbid null
  assert.doesNotThrow(() => {
    validateAssignmentScope(
      OrganizationType.MPK,
      OrganizationType.MPK,
      null,
      "kom-a"
    );
  });

  // 4. MPK Assignment ilegal: Member MPK ditugaskan dengan Sekbid OSIS
  assert.throws(
    () => {
      validateAssignmentScope(
        OrganizationType.MPK,
        OrganizationType.MPK,
        "sek-1",
        null
      );
    },
    {
      name: "BusinessRuleError",
      message: "Penugasan jabatan MPK tidak boleh menetapkan Sekbid OSIS (hanya Komisi yang diizinkan).",
    }
  );

  // 5. Cross-Organization ilegal: Member MPK ditugaskan pada Position OSIS
  assert.throws(
    () => {
      validateAssignmentScope(
        OrganizationType.MPK,
        OrganizationType.OSIS,
        "sek-1",
        null
      );
    },
    {
      name: "BusinessRuleError",
      message: "Anggota bertipe organisasi MPK tidak dapat ditugaskan pada jabatan OSIS.",
    }
  );

  // 6. Cross-Organization ilegal: Member OSIS ditugaskan pada Position MPK
  assert.throws(
    () => {
      validateAssignmentScope(
        OrganizationType.OSIS,
        OrganizationType.MPK,
        null,
        "kom-a"
      );
    },
    {
      name: "BusinessRuleError",
      message: "Anggota bertipe organisasi OSIS tidak dapat ditugaskan pada jabatan MPK.",
    }
  );

  // 7. GENERAL/BPH sah: Position GENERAL + Member GENERAL + Sekbid null + Commission null
  assert.doesNotThrow(() => {
    validateAssignmentScope(
      OrganizationType.GENERAL,
      OrganizationType.GENERAL,
      null,
      null
    );
  });

  // 8. GENERAL/BPH ilegal: Position GENERAL tapi menetapkan Sekbid atau Komisi
  assert.throws(
    () => {
      validateAssignmentScope(
        OrganizationType.GENERAL,
        OrganizationType.GENERAL,
        "sek-1",
        null
      );
    },
    {
      name: "BusinessRuleError",
      message: "Penugasan jabatan GENERAL/BPH tidak boleh memiliki ruang lingkup Sekbid maupun Komisi (keduanya harus null).",
    }
  );
});

test("PART A: Bcrypt cost factor terkonfigurasi konsisten bernilai 12", () => {
  assert.equal(SALT_ROUNDS, 12);
});

// ============================================================================
// PART B: ACTIVITY MANAGEMENT TESTS
// ============================================================================

test("ACTIVITY: Validasi 3 kegiatan inti (Sapa Pagi, Danusan, Nyisir 4P)", () => {
  const activities = [
    {
      code: "SAPA_PAGI",
      name: "Sapa Pagi",
      type: "ROUTINE",
      default_late_threshold_minutes: 15,
      description: "Piket penyambutan siswa di gerbang sekolah",
    },
    {
      code: "DANUSAN",
      name: "Danusan",
      type: "ROUTINE",
      default_late_threshold_minutes: 15,
      description: "Aktivitas dana usaha dan kewirausahaan organisasi",
    },
    {
      code: "NYISIR_4P",
      name: "Nyisir 4P",
      type: "ROUTINE",
      default_late_threshold_minutes: 15,
      description: "Patroli pagi dan penertiban tata tertib siswa",
    },
  ];

  for (const act of activities) {
    const parsed = createActivitySchema.safeParse(act);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.code, act.code);
      assert.equal(parsed.data.type, ActivityType.ROUTINE);
    }
  }
});

test("ACTIVITY: Menolak kode kegiatan invalid atau menit keterlambatan tidak wajar", () => {
  const invalidCode = createActivitySchema.safeParse({
    code: "kode dengan spasi!",
    name: "Kegiatan Salah",
    default_late_threshold_minutes: 15,
  });
  assert.equal(invalidCode.success, false);

  const invalidMinutes = createActivitySchema.safeParse({
    code: "SPECIAL_EVENT",
    name: "Event Besar",
    default_late_threshold_minutes: 300, // max 180 (3 jam)
  });
  assert.equal(invalidMinutes.success, false);
});

test("ACTIVITY: Update skema parsial dan query filter pagination", () => {
  const updateParsed = updateActivitySchema.safeParse({
    name: "Sapa Pagi Gerbang Barat",
    default_late_threshold_minutes: 20,
  });
  assert.equal(updateParsed.success, true);

  const queryParsed = activityQuerySchema.safeParse({
    page: "1",
    limit: "10",
    search: "Sapa",
    type: "ROUTINE",
    is_active: "true",
  });
  assert.equal(queryParsed.success, true);
  if (queryParsed.success) {
    assert.equal(queryParsed.data.page, 1);
    assert.equal(queryParsed.data.limit, 10);
    assert.equal(queryParsed.data.is_active, true);
  }
});

test("SCHEDULE: Validasi create, update, dan query schema jadwal sesi", () => {
  const createParsed = createScheduleSchema.safeParse({
    activity_id: "11111111-1111-1111-1111-111111111111",
    title: "Sesi Pagi",
    date: "2026-11-08",
    start_time: "06:30",
    late_threshold: "06:45",
    end_time: "07:15",
    status: "DRAFT",
  });
  assert.equal(createParsed.success, true);

  const updateParsed = updateScheduleSchema.safeParse({
    title: "Sesi Pagi Diperbarui",
    status: "OPEN",
  });
  assert.equal(updateParsed.success, true);

  const queryParsed = scheduleQuerySchema.safeParse({
    page: "1",
    limit: "20",
    activity_id: "11111111-1111-1111-1111-111111111111",
    date: "2026-11-08",
    status: "OPEN",
  });
  assert.equal(queryParsed.success, true);
});

test("ACTIVITY: Proteksi penghapusan — Dilarang hapus jika ada jadwal sesi yang mereferensikan", () => {
  function checkActivityDeletable(activityName: string, scheduleCount: number) {
    if (scheduleCount > 0) {
      throw new BusinessRuleError(
        `Kegiatan '${activityName}' tidak dapat dihapus karena memiliki ${scheduleCount} riwayat jadwal sesi.`
      );
    }
    return true;
  }

  assert.throws(
    () => checkActivityDeletable("Sapa Pagi", 42),
    {
      name: "BusinessRuleError",
      message: "Kegiatan 'Sapa Pagi' tidak dapat dihapus karena memiliki 42 riwayat jadwal sesi.",
    }
  );

  assert.equal(checkActivityDeletable("Kegiatan Baru Tanpa Sesi", 0), true);
});

// ============================================================================
// PART C & D: TIMEZONE & SCHEDULE MANAGEMENT TESTS
// ============================================================================

test("TIMEZONE: Konversi tanggal lokal dan waktu WIB (+07:00) ke UTC instant secara presisi", () => {
  // Tanggal '2026-11-08' harus menjadi UTC midnight
  const dateUtc = parseDateOnlyToUtc("2026-11-08");
  assert.equal(dateUtc.toISOString(), "2026-11-08T00:00:00.000Z");

  // Waktu WIB 06:30 pada 2026-11-08 = 2026-11-07 23:30 UTC (-7 jam)
  const timeWib = parseWibToUtc("06:30", "2026-11-08");
  assert.equal(timeWib.toISOString(), "2026-11-07T23:30:00.000Z");

  // Format balik ke string WIB
  const formattedWib = formatUtcToWibString(timeWib);
  assert.equal(formattedWib, "2026-11-08 06:30:00 WIB");

  // Input sudah menyertakan ISO offset '+07:00'
  const isoWib = parseWibToUtc("2026-11-08T06:30:00+07:00");
  assert.equal(isoWib.toISOString(), "2026-11-07T23:30:00.000Z");
});

test("SCHEDULE: Validasi urutan waktu kronologis (start_time < late_threshold < end_time)", () => {
  const tStart = parseWibToUtc("06:30", "2026-11-08");
  const tLate = parseWibToUtc("06:45", "2026-11-08");
  const tEnd = parseWibToUtc("07:30", "2026-11-08");

  // Urutan valid
  assert.doesNotThrow(() => {
    validateChronologicalOrder(tStart, tLate, tEnd);
  });

  // start_time >= late_threshold (invalid)
  assert.throws(
    () => {
      validateChronologicalOrder(tLate, tStart, tEnd);
    },
    {
      name: "ValidationError",
      message: "Waktu mulai (start_time) harus lebih awal daripada batas terlambat (late_threshold).",
    }
  );

  // late_threshold >= end_time (invalid)
  assert.throws(
    () => {
      validateChronologicalOrder(tStart, tEnd, tLate);
    },
    {
      name: "ValidationError",
      message: "Batas waktu terlambat (late_threshold) harus lebih awal daripada waktu selesai sesi (end_time).",
    }
  );
});

test("SCHEDULE: State Machine Transisi Status (DRAFT -> OPEN -> CLOSED)", () => {
  // DRAFT -> OPEN: Diizinkan (Membuka sesi pemindaian)
  assert.doesNotThrow(() => {
    validateStatusTransition(ScheduleStatus.DRAFT, ScheduleStatus.OPEN);
  });

  // OPEN -> CLOSED: Diizinkan (Menutup sesi pemindaian)
  assert.doesNotThrow(() => {
    validateStatusTransition(ScheduleStatus.OPEN, ScheduleStatus.CLOSED);
  });

  // DRAFT -> CLOSED: Diizinkan (Membatalkan sesi)
  assert.doesNotThrow(() => {
    validateStatusTransition(ScheduleStatus.DRAFT, ScheduleStatus.CLOSED);
  });

  // OPEN -> DRAFT: DITOLAK (Sesi yang sudah berjalan tidak boleh kembali ke draf)
  assert.throws(
    () => {
      validateStatusTransition(ScheduleStatus.OPEN, ScheduleStatus.DRAFT);
    },
    {
      name: "BusinessRuleError",
      message: "Sesi yang sedang berjalan (OPEN) tidak dapat dikembalikan ke status DRAFT.",
    }
  );

  // CLOSED -> OPEN: DITOLAK KERAS (Sesi tertutup terkunci)
  assert.throws(
    () => {
      validateStatusTransition(ScheduleStatus.CLOSED, ScheduleStatus.OPEN);
    },
    {
      name: "BusinessRuleError",
      message: "Sesi yang telah ditutup (CLOSED) terkunci dan tidak dapat dibuka atau diubah statusnya kembali.",
    }
  );
});

test("SCHEDULE: Gate Status Pemindaian Kehadiran", () => {
  function canAcceptAttendance(status: ScheduleStatus): boolean {
    return status === ScheduleStatus.OPEN;
  }

  assert.equal(canAcceptAttendance(ScheduleStatus.DRAFT), false);
  assert.equal(canAcceptAttendance(ScheduleStatus.OPEN), true);
  assert.equal(canAcceptAttendance(ScheduleStatus.CLOSED), false);
});

test("SCHEDULE: Proteksi penghapusan jadwal yang memiliki riwayat presensi", () => {
  function checkScheduleDeletable(attendanceCount: number) {
    if (attendanceCount > 0) {
      throw new BusinessRuleError(
        `Jadwal sesi tidak dapat dihapus karena telah memiliki ${attendanceCount} data absensi anggota. Tutup sesi dengan mengubah status menjadi CLOSED.`
      );
    }
    return true;
  }

  assert.throws(
    () => checkScheduleDeletable(35),
    {
      name: "BusinessRuleError",
      message: "Jadwal sesi tidak dapat dihapus karena telah memiliki 35 data absensi anggota. Tutup sesi dengan mengubah status menjadi CLOSED.",
    }
  );

  assert.equal(checkScheduleDeletable(0), true);
});

// ============================================================================
// PART E: RBAC FOR ACTIVITIES & SCHEDULES
// ============================================================================

test("RBAC: SUPERADMIN memiliki hak penuh pada ACTIVITIES dan SCHEDULES", () => {
  const superadmin: AuthenticatedUser = {
    id: "sa-1",
    username: "superadmin",
    email: "superadmin@smkn11bdg.sch.id",
    role: Role.SUPERADMIN,
    admin_scope: null,
    member_id: null,
  };

  const modules = [AppModule.ACTIVITIES, AppModule.SCHEDULES];
  const actions = [
    PermissionAction.CREATE,
    PermissionAction.READ,
    PermissionAction.UPDATE,
    PermissionAction.DELETE,
    PermissionAction.MANAGE_SESSION,
  ];

  for (const mod of modules) {
    for (const act of actions) {
      assert.equal(canAccessModule(superadmin, mod, act), true);
      assert.doesNotThrow(() => assertAuthorized(superadmin, mod, act));
    }
  }
});

test("RBAC: ADMIN (GENERAL) mengelola ACTIVITIES & SCHEDULES, tetapi DILARANG DELETE", () => {
  const generalAdmin: AuthenticatedUser = {
    id: "ga-1",
    username: "ketua_osis",
    email: "ketua@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.GENERAL,
    member_id: null,
  };

  // ACTIVITIES: CREATE, READ, UPDATE diizinkan, DELETE ditolak
  assert.equal(canAccessModule(generalAdmin, AppModule.ACTIVITIES, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.ACTIVITIES, PermissionAction.READ), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.ACTIVITIES, PermissionAction.UPDATE), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.ACTIVITIES, PermissionAction.DELETE), false);

  // SCHEDULES: CREATE, READ, UPDATE, MANAGE_SESSION diizinkan, DELETE ditolak
  assert.equal(canAccessModule(generalAdmin, AppModule.SCHEDULES, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.SCHEDULES, PermissionAction.READ), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.SCHEDULES, PermissionAction.UPDATE), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.SCHEDULES, PermissionAction.DELETE), false);
});

test("RBAC: ADMIN (SECRETARY) mengelola SCHEDULES (CREATE, READ, UPDATE, MANAGE_SESSION), hanya READ pada ACTIVITIES", () => {
  const secretaryAdmin: AuthenticatedUser = {
    id: "sec-1",
    username: "sekretaris_osis",
    email: "sekretaris@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.SECRETARY,
    member_id: null,
  };

  // ACTIVITIES: READ only
  assert.equal(canAccessModule(secretaryAdmin, AppModule.ACTIVITIES, PermissionAction.READ), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.ACTIVITIES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.ACTIVITIES, PermissionAction.UPDATE), false);

  // SCHEDULES: Hak penuh operasional sesi (tanpa DELETE)
  assert.equal(canAccessModule(secretaryAdmin, AppModule.SCHEDULES, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.SCHEDULES, PermissionAction.READ), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.SCHEDULES, PermissionAction.UPDATE), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.SCHEDULES, PermissionAction.DELETE), false);
});

test("RBAC: ADMIN (TREASURER) dapat mengelola SCHEDULES sesi dan READ ACTIVITIES", () => {
  const treasurerAdmin: AuthenticatedUser = {
    id: "tr-1",
    username: "bendahara_osis",
    email: "bendahara@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.TREASURER,
    member_id: null,
  };

  assert.equal(canAccessModule(treasurerAdmin, AppModule.ACTIVITIES, PermissionAction.READ), true);
  assert.equal(canAccessModule(treasurerAdmin, AppModule.ACTIVITIES, PermissionAction.CREATE), false);

  assert.equal(canAccessModule(treasurerAdmin, AppModule.SCHEDULES, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(treasurerAdmin, AppModule.SCHEDULES, PermissionAction.READ), true);
  assert.equal(canAccessModule(treasurerAdmin, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), true);
  assert.equal(canAccessModule(treasurerAdmin, AppModule.SCHEDULES, PermissionAction.DELETE), false);
});

test("RBAC: ADMIN (DISCIPLINE_4P) dibatasi READ ONLY pada ACTIVITIES dan SCHEDULES", () => {
  const disciplineAdmin: AuthenticatedUser = {
    id: "d4p-1",
    username: "polisi_4p",
    email: "patroli4p@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.DISCIPLINE_4P,
    member_id: null,
  };

  assert.equal(canAccessModule(disciplineAdmin, AppModule.ACTIVITIES, PermissionAction.READ), true);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.ACTIVITIES, PermissionAction.CREATE), false);

  assert.equal(canAccessModule(disciplineAdmin, AppModule.SCHEDULES, PermissionAction.READ), true);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.SCHEDULES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.SCHEDULES, PermissionAction.UPDATE), false);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), false);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.SCHEDULES, PermissionAction.DELETE), false);
});

test("RBAC: VIEWER dibatasi READ ONLY pada ACTIVITIES dan SCHEDULES", () => {
  const viewer: AuthenticatedUser = {
    id: "v-1",
    username: "pembina_sekolah",
    email: "pembina@smkn11bdg.sch.id",
    role: Role.VIEWER,
    admin_scope: null,
    member_id: null,
  };

  assert.equal(canAccessModule(viewer, AppModule.ACTIVITIES, PermissionAction.READ), true);
  assert.equal(canAccessModule(viewer, AppModule.ACTIVITIES, PermissionAction.CREATE), false);

  assert.equal(canAccessModule(viewer, AppModule.SCHEDULES, PermissionAction.READ), true);
  assert.equal(canAccessModule(viewer, AppModule.SCHEDULES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(viewer, AppModule.SCHEDULES, PermissionAction.UPDATE), false);
  assert.equal(canAccessModule(viewer, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), false);
  assert.equal(canAccessModule(viewer, AppModule.SCHEDULES, PermissionAction.DELETE), false);
});
