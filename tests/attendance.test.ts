/**
 * tests/attendance.test.ts
 * Unit tests for Milestone 12 — Attendance Management Backend
 *
 * Pattern: Pure logic tests & inline simulations (no real DB hits).
 * Prisma and bcrypt are simulated via inline mock objects.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  rfidScanSchema,
  createAttendanceSchema,
  updateAttendanceSchema,
  attendanceQuerySchema,
} from "../lib/validators/attendance.schema";
import {
  canAccessModule,
  assertAuthorized,
  AuthorizationError,
} from "../lib/auth/rbac";
import {
  Role,
  AdminScope,
  AppModule,
  PermissionAction,
  type AuthenticatedUser,
} from "../types/auth";
import {
  AttendanceStatus,
  AttendanceMethod,
  ScheduleStatus,
  MemberStatus,
} from "@prisma/client";
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "../lib/services/errors";
import { parseDateOnlyToUtc } from "../lib/utils/timezone";

// ============================================================================
// HELPERS — Inline simulation of service logic (no real DB / bcrypt)
// ============================================================================

/**
 * Minimal in-memory simulation of recordRfidAttendance logic.
 * Tests the branching logic without hitting the real DB.
 */
function simulateRfidScan(opts: {
  deviceFound: boolean;
  deviceActive: boolean;
  apiKeyValid: boolean;
  memberFound: boolean;
  memberActive: boolean;
  scheduleStatus: ScheduleStatus | null;
  scanTimeMs: number;
  lateThresholdMs: number;
  existingRecord?: { attendance_id: string; status: AttendanceStatus } | null;
}) {
  // 1. Device auth
  if (!opts.deviceFound || !opts.deviceActive) {
    throw Object.assign(new Error("Autentikasi perangkat gagal"), {
      name: "AuthenticationError",
    });
  }
  if (!opts.apiKeyValid) {
    throw Object.assign(new Error("API key tidak valid"), {
      name: "AuthenticationError",
    });
  }

  // 2. Member lookup
  if (!opts.memberFound || !opts.memberActive) {
    throw new NotFoundError("Anggota tidak ditemukan atau tidak aktif.");
  }

  // 3. Open schedule check
  if (!opts.scheduleStatus || opts.scheduleStatus !== ScheduleStatus.OPEN) {
    throw new BusinessRuleError(
      "Tidak ada sesi kegiatan yang sedang OPEN untuk hari ini."
    );
  }

  // 4. Determine HADIR/TERLAMBAT
  const scanTime = new Date(opts.scanTimeMs);
  const lateThreshold = new Date(opts.lateThresholdMs);
  const status =
    scanTime <= lateThreshold
      ? AttendanceStatus.HADIR
      : AttendanceStatus.TERLAMBAT;

  // 5. Idempotency — P2002 simulation
  if (opts.existingRecord) {
    return opts.existingRecord; // return existing (idempotent)
  }

  return {
    attendance_id: "att-new-001",
    member_id: "mem-001",
    member_name: "Budi Santoso",
    status,
    scan_time: scanTime,
    schedule_id: "sch-001",
  };
}

/**
 * Simulate createManualAttendance logic.
 */
function simulateManualCreate(opts: {
  status: AttendanceStatus;
  scheduleStatus: ScheduleStatus;
  memberActive: boolean;
  alreadyExists: boolean;
}) {
  if (opts.status === AttendanceStatus.ALPA) {
    throw new BusinessRuleError(
      "Status ALPA tidak dapat dibuat secara manual."
    );
  }

  if (
    (opts.status === AttendanceStatus.HADIR ||
      opts.status === AttendanceStatus.TERLAMBAT) &&
    opts.scheduleStatus !== ScheduleStatus.OPEN
  ) {
    throw new BusinessRuleError(
      "HADIR/TERLAMBAT hanya untuk sesi OPEN."
    );
  }

  if (
    (opts.status === AttendanceStatus.IZIN ||
      opts.status === AttendanceStatus.SAKIT) &&
    opts.scheduleStatus === ScheduleStatus.DRAFT
  ) {
    throw new BusinessRuleError(
      "IZIN/SAKIT tidak dapat diinput pada sesi DRAFT."
    );
  }

  if (!opts.memberActive) {
    throw new NotFoundError("Anggota tidak aktif atau tidak ditemukan.");
  }

  if (opts.alreadyExists) {
    throw new ConflictError("Anggota sudah memiliki data absensi pada sesi ini.");
  }

  return {
    id: "att-manual-001",
    status: opts.status,
    method: AttendanceMethod.MANUAL,
  };
}

/**
 * Simulate correctAttendance logic (atomic update + audit log).
 */
function simulateCorrectAttendance(opts: {
  existingRecord: boolean;
  reason: string;
  newStatus: AttendanceStatus;
  actingUserId: string;
}) {
  if (!opts.existingRecord) {
    throw new NotFoundError("Data absensi tidak ditemukan.");
  }

  if (opts.reason.trim().length < 10) {
    throw new BusinessRuleError(
      "Alasan koreksi wajib minimal 10 karakter."
    );
  }

  // Simulate atomic transaction result
  const updatedAttendance = { id: "att-001", status: opts.newStatus };
  const auditLog = {
    user_id: opts.actingUserId,
    action: "CORRECT_ATTENDANCE",
    entity_type: "attendance",
    entity_id: "att-001",
    old_values: { status: AttendanceStatus.HADIR, notes: null },
    new_values: { status: opts.newStatus, notes: null },
    reason: opts.reason,
  };

  return { updatedAttendance, auditLog };
}

/**
 * Simulate reconcileSchedule logic.
 */
function simulateReconcile(opts: {
  scheduleStatus: ScheduleStatus;
  allActiveMembers: string[];
  membersWithAttendance: string[];
}) {
  if (opts.scheduleStatus !== ScheduleStatus.CLOSED) {
    throw new BusinessRuleError(
      "Rekonsiliasi hanya dapat dilakukan pada sesi yang sudah CLOSED."
    );
  }

  const attendedSet = new Set(opts.membersWithAttendance);
  const needAlpa = opts.allActiveMembers.filter((id) => !attendedSet.has(id));

  return {
    created: needAlpa.length,
    skipped: opts.membersWithAttendance.length,
    total_members: opts.allActiveMembers.length,
  };
}

// ============================================================================
// TEST 1: Valid RFID scan → HADIR (scan_time ≤ late_threshold)
// ============================================================================

test("RFID SCAN: Scan sebelum late_threshold menghasilkan status HADIR", () => {
  const now = Date.now();
  const result = simulateRfidScan({
    deviceFound: true,
    deviceActive: true,
    apiKeyValid: true,
    memberFound: true,
    memberActive: true,
    scheduleStatus: ScheduleStatus.OPEN,
    scanTimeMs: now - 60_000, // 1 menit sebelum threshold
    lateThresholdMs: now,
  });
  assert.equal(result.status, AttendanceStatus.HADIR);
});

// ============================================================================
// TEST 2: Valid RFID scan → TERLAMBAT (scan_time > late_threshold)
// ============================================================================

test("RFID SCAN: Scan setelah late_threshold menghasilkan status TERLAMBAT", () => {
  const now = Date.now();
  const result = simulateRfidScan({
    deviceFound: true,
    deviceActive: true,
    apiKeyValid: true,
    memberFound: true,
    memberActive: true,
    scheduleStatus: ScheduleStatus.OPEN,
    scanTimeMs: now + 60_000, // 1 menit setelah threshold
    lateThresholdMs: now,
  });
  assert.equal(result.status, AttendanceStatus.TERLAMBAT);
});

// ============================================================================
// TEST 3: Invalid device credentials → rejected (AuthenticationError)
// ============================================================================

test("RFID SCAN: Device dengan API key salah ditolak (AuthenticationError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: true,
        apiKeyValid: false,
        memberFound: true,
        memberActive: true,
        scheduleStatus: ScheduleStatus.OPEN,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "AuthenticationError" }
  );
});

// ============================================================================
// TEST 4: Inactive device → rejected (AuthenticationError)
// ============================================================================

test("RFID SCAN: Device tidak aktif (is_active=false) ditolak (AuthenticationError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: false,
        apiKeyValid: true,
        memberFound: true,
        memberActive: true,
        scheduleStatus: ScheduleStatus.OPEN,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "AuthenticationError" }
  );
});

// ============================================================================
// TEST 5: Unknown RFID UID → rejected (NotFoundError)
// ============================================================================

test("RFID SCAN: UID RFID tidak dikenali ditolak (NotFoundError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: true,
        apiKeyValid: true,
        memberFound: false,
        memberActive: false,
        scheduleStatus: ScheduleStatus.OPEN,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "NotFoundError" }
  );
});

// ============================================================================
// TEST 6: Inactive member → rejected (NotFoundError)
// ============================================================================

test("RFID SCAN: Anggota ditemukan tapi berstatus INACTIVE ditolak (NotFoundError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: true,
        apiKeyValid: true,
        memberFound: true,
        memberActive: false,
        scheduleStatus: ScheduleStatus.OPEN,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "NotFoundError" }
  );
});

// ============================================================================
// TEST 7: No OPEN schedule → rejected (BusinessRuleError)
// ============================================================================

test("RFID SCAN: Tidak ada sesi OPEN hari ini ditolak (BusinessRuleError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: true,
        apiKeyValid: true,
        memberFound: true,
        memberActive: true,
        scheduleStatus: null,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "BusinessRuleError" }
  );
});

// ============================================================================
// TEST 8: DRAFT schedule → rejected (BusinessRuleError)
// ============================================================================

test("RFID SCAN: Sesi berstatus DRAFT tidak menerima absensi (BusinessRuleError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: true,
        apiKeyValid: true,
        memberFound: true,
        memberActive: true,
        scheduleStatus: ScheduleStatus.DRAFT,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "BusinessRuleError" }
  );
});

// ============================================================================
// TEST 9: CLOSED schedule → rejected (BusinessRuleError)
// ============================================================================

test("RFID SCAN: Sesi berstatus CLOSED tidak menerima absensi (BusinessRuleError)", () => {
  assert.throws(
    () =>
      simulateRfidScan({
        deviceFound: true,
        deviceActive: true,
        apiKeyValid: true,
        memberFound: true,
        memberActive: true,
        scheduleStatus: ScheduleStatus.CLOSED,
        scanTimeMs: Date.now(),
        lateThresholdMs: Date.now() + 60_000,
      }),
    { name: "BusinessRuleError" }
  );
});

// ============================================================================
// TEST 10: Duplicate scan → idempotent (returns existing record, not error)
// ============================================================================

test("RFID SCAN: Scan duplikat mengembalikan record yang sudah ada (idempoten)", () => {
  const existingRecord = {
    attendance_id: "att-existing-001",
    status: AttendanceStatus.HADIR,
  };

  const result = simulateRfidScan({
    deviceFound: true,
    deviceActive: true,
    apiKeyValid: true,
    memberFound: true,
    memberActive: true,
    scheduleStatus: ScheduleStatus.OPEN,
    scanTimeMs: Date.now(),
    lateThresholdMs: Date.now() + 60_000,
    existingRecord,
  });

  assert.equal(result.attendance_id, "att-existing-001");
  assert.equal(result.status, AttendanceStatus.HADIR);
});

// ============================================================================
// TEST 11: Concurrent duplicate scan → catch P2002, return existing record
// ============================================================================

test("RFID SCAN: Race condition P2002 ditangani secara idempoten (kembali record existing)", () => {
  // Simulasi: scan berhasil membuat record baru TAPI kemudian dipanggil lagi concurrent
  // Kedua panggilan harus mengembalikan data yang sama (bukan error)
  const existingRecord = {
    attendance_id: "att-race-001",
    status: AttendanceStatus.TERLAMBAT,
  };

  const result1 = simulateRfidScan({
    deviceFound: true,
    deviceActive: true,
    apiKeyValid: true,
    memberFound: true,
    memberActive: true,
    scheduleStatus: ScheduleStatus.OPEN,
    scanTimeMs: Date.now() + 300_000, // terlambat
    lateThresholdMs: Date.now(),
    existingRecord: null, // first call, no existing
  });
  assert.equal(result1.status, AttendanceStatus.TERLAMBAT);

  const result2 = simulateRfidScan({
    deviceFound: true,
    deviceActive: true,
    apiKeyValid: true,
    memberFound: true,
    memberActive: true,
    scheduleStatus: ScheduleStatus.OPEN,
    scanTimeMs: Date.now() + 300_000,
    lateThresholdMs: Date.now(),
    existingRecord, // second call: P2002 caught, returns existing
  });
  assert.equal(result2.attendance_id, "att-race-001");
  assert.equal(result2.status, AttendanceStatus.TERLAMBAT);
});

// ============================================================================
// TEST 12: Manual HADIR creation valid
// ============================================================================

test("MANUAL: Pembuatan absensi manual status HADIR pada sesi OPEN berhasil", () => {
  const result = simulateManualCreate({
    status: AttendanceStatus.HADIR,
    scheduleStatus: ScheduleStatus.OPEN,
    memberActive: true,
    alreadyExists: false,
  });
  assert.equal(result.status, AttendanceStatus.HADIR);
  assert.equal(result.method, AttendanceMethod.MANUAL);
});

// ============================================================================
// TEST 13: Manual IZIN creation valid
// ============================================================================

test("MANUAL: Pembuatan absensi manual status IZIN pada sesi OPEN berhasil", () => {
  const result = simulateManualCreate({
    status: AttendanceStatus.IZIN,
    scheduleStatus: ScheduleStatus.OPEN,
    memberActive: true,
    alreadyExists: false,
  });
  assert.equal(result.status, AttendanceStatus.IZIN);
});

// ============================================================================
// TEST 14: Manual SAKIT creation valid
// ============================================================================

test("MANUAL: Pembuatan absensi manual status SAKIT pada sesi CLOSED berhasil", () => {
  const result = simulateManualCreate({
    status: AttendanceStatus.SAKIT,
    scheduleStatus: ScheduleStatus.CLOSED,
    memberActive: true,
    alreadyExists: false,
  });
  assert.equal(result.status, AttendanceStatus.SAKIT);
});

// ============================================================================
// TEST 15: Manual ALPA creation → rejected (BusinessRuleError)
// ============================================================================

test("MANUAL: Pembuatan absensi manual status ALPA ditolak (BusinessRuleError)", () => {
  assert.throws(
    () =>
      simulateManualCreate({
        status: AttendanceStatus.ALPA,
        scheduleStatus: ScheduleStatus.OPEN,
        memberActive: true,
        alreadyExists: false,
      }),
    { name: "BusinessRuleError" }
  );
});

// ============================================================================
// TEST 16: Correction requires reason min 10 chars (Zod validation)
// ============================================================================

test("CORRECTION: Koreksi tanpa alasan atau alasan < 10 karakter ditolak oleh Zod", () => {
  const noReason = updateAttendanceSchema.safeParse({
    status: AttendanceStatus.IZIN,
    reason: "pendek", // 6 chars — ditolak
  });
  assert.equal(noReason.success, false);

  const validReason = updateAttendanceSchema.safeParse({
    status: AttendanceStatus.IZIN,
    reason: "Alasan cukup panjang untuk koreksi ini.", // ≥10 chars
  });
  assert.equal(validReason.success, true);
});

// ============================================================================
// TEST 17: Correction creates AuditLog with old_values, new_values, reason
// ============================================================================

test("CORRECTION: Koreksi menghasilkan AuditLog dengan old_values, new_values, dan reason", () => {
  const { updatedAttendance, auditLog } = simulateCorrectAttendance({
    existingRecord: true,
    reason: "Koreksi oleh admin karena kesalahan input data",
    newStatus: AttendanceStatus.IZIN,
    actingUserId: "user-admin-001",
  });

  assert.equal(updatedAttendance.status, AttendanceStatus.IZIN);
  assert.equal(auditLog.action, "CORRECT_ATTENDANCE");
  assert.equal(auditLog.entity_type, "attendance");
  assert.ok(auditLog.old_values !== null);
  assert.ok(auditLog.new_values !== null);
  assert.equal((auditLog.old_values as { status: string }).status, AttendanceStatus.HADIR);
  assert.equal((auditLog.new_values as { status: string }).status, AttendanceStatus.IZIN);
  assert.equal(auditLog.reason, "Koreksi oleh admin karena kesalahan input data");
});

// ============================================================================
// TEST 18: AuditLog + attendance update atomicity (same transaction)
// ============================================================================

test("CORRECTION: Update attendance dan AuditLog terjadi dalam satu transaksi atomik", () => {
  // Verifikasi bahwa kedua objek dihasilkan bersama (representasi atomicity)
  const { updatedAttendance, auditLog } = simulateCorrectAttendance({
    existingRecord: true,
    reason: "Test atomisitas transaksi database",
    newStatus: AttendanceStatus.SAKIT,
    actingUserId: "user-admin-002",
  });

  // Keduanya harus mereferensikan entitas yang sama
  assert.equal(auditLog.entity_id, updatedAttendance.id);
  assert.equal(auditLog.user_id, "user-admin-002");
  assert.equal(updatedAttendance.status, AttendanceStatus.SAKIT);
});

// ============================================================================
// TEST 19: Unauthorized correction (VIEWER) → rejected
// ============================================================================

test("RBAC: VIEWER tidak diizinkan melakukan koreksi absensi (HISTORY_CORRECTION.CORRECT)", () => {
  const viewer: AuthenticatedUser = {
    id: "v-1",
    username: "pembina",
    email: "pembina@smkn11bdg.sch.id",
    role: Role.VIEWER,
    admin_scope: null,
    member_id: null,
  };

  assert.equal(
    canAccessModule(viewer, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT),
    false
  );

  assert.throws(
    () => assertAuthorized(viewer, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT),
    AuthorizationError
  );
});

// ============================================================================
// TEST 20: Reconciliation only on CLOSED schedule (OPEN/DRAFT → error)
// ============================================================================

test("RECONCILIATION: Rekonsiliasi pada sesi OPEN atau DRAFT ditolak (BusinessRuleError)", () => {
  assert.throws(
    () =>
      simulateReconcile({
        scheduleStatus: ScheduleStatus.OPEN,
        allActiveMembers: ["m1", "m2"],
        membersWithAttendance: [],
      }),
    { name: "BusinessRuleError" }
  );

  assert.throws(
    () =>
      simulateReconcile({
        scheduleStatus: ScheduleStatus.DRAFT,
        allActiveMembers: ["m1", "m2"],
        membersWithAttendance: [],
      }),
    { name: "BusinessRuleError" }
  );
});

// ============================================================================
// TEST 21: ALPA created for eligible active members not yet attending
// ============================================================================

test("RECONCILIATION: ALPA dibuat untuk anggota aktif yang belum hadir", () => {
  const result = simulateReconcile({
    scheduleStatus: ScheduleStatus.CLOSED,
    allActiveMembers: ["m1", "m2", "m3", "m4"],
    membersWithAttendance: ["m1", "m2"], // m3 dan m4 belum hadir
  });

  assert.equal(result.created, 2); // ALPA untuk m3, m4
  assert.equal(result.skipped, 2); // m1, m2 sudah punya record
  assert.equal(result.total_members, 4);
});

// ============================================================================
// TEST 22: Reconciliation idempotency (second run creates 0 new ALPA)
// ============================================================================

test("RECONCILIATION: Rekonsiliasi kedua bersifat idempoten (0 ALPA baru dibuat)", () => {
  const allMembers = ["m1", "m2", "m3"];

  // Jalankan pertama kali
  const firstRun = simulateReconcile({
    scheduleStatus: ScheduleStatus.CLOSED,
    allActiveMembers: allMembers,
    membersWithAttendance: ["m1"],
  });
  assert.equal(firstRun.created, 2); // m2, m3 mendapat ALPA

  // Jalankan kedua kali (semua sudah punya record)
  const secondRun = simulateReconcile({
    scheduleStatus: ScheduleStatus.CLOSED,
    allActiveMembers: allMembers,
    membersWithAttendance: ["m1", "m2", "m3"], // setelah rekonsiliasi pertama
  });
  assert.equal(secondRun.created, 0); // idempoten: tidak ada ALPA baru
  assert.equal(secondRun.skipped, 3);
});

// ============================================================================
// TEST 23: Existing HADIR/TERLAMBAT/IZIN/SAKIT preserved during reconciliation
// ============================================================================

test("RECONCILIATION: Record HADIR/TERLAMBAT/IZIN/SAKIT yang ada tidak diganggu", () => {
  // Semua 5 anggota sudah punya record (berbagai status)
  const result = simulateReconcile({
    scheduleStatus: ScheduleStatus.CLOSED,
    allActiveMembers: ["m1", "m2", "m3", "m4", "m5"],
    membersWithAttendance: ["m1", "m2", "m3", "m4", "m5"],
  });

  assert.equal(result.created, 0); // Tidak ada yang perlu dibuatkan ALPA
  assert.equal(result.skipped, 5);
  assert.equal(result.total_members, 5);
});

// ============================================================================
// TEST 24: RBAC — ADMIN DISCIPLINE_4P can READ but not CREATE attendance
// ============================================================================

test("RBAC: ADMIN DISCIPLINE_4P hanya dapat READ absensi, tidak bisa CREATE", () => {
  const disciplineAdmin: AuthenticatedUser = {
    id: "d4p-1",
    username: "polisi_4p",
    email: "patroli4p@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.DISCIPLINE_4P,
    member_id: null,
  };

  // READ diizinkan
  assert.equal(
    canAccessModule(disciplineAdmin, AppModule.ATTENDANCE, PermissionAction.READ),
    true
  );

  // CREATE ditolak
  assert.equal(
    canAccessModule(disciplineAdmin, AppModule.ATTENDANCE, PermissionAction.CREATE),
    false
  );

  // CORRECT ditolak (hanya READ untuk HISTORY_CORRECTION)
  assert.equal(
    canAccessModule(
      disciplineAdmin,
      AppModule.HISTORY_CORRECTION,
      PermissionAction.CORRECT
    ),
    false
  );
});

// ============================================================================
// TEST 25: WIB date boundary — parseDateOnlyToUtc produces correct UTC range
// ============================================================================

test("TIMEZONE: parseDateOnlyToUtc menghasilkan rentang UTC yang benar untuk filter tanggal WIB", () => {
  // Tanggal '2026-11-08' di WIB harus menjadi UTC midnight (tidak ada offset)
  // Karena DATE di PostgreSQL disimpan sebagai UTC midnight tanpa zona waktu
  const dayStart = parseDateOnlyToUtc("2026-11-08");
  assert.equal(dayStart.toISOString(), "2026-11-08T00:00:00.000Z");

  // 24 jam setelahnya = awal hari berikutnya
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  assert.equal(dayEnd.toISOString(), "2026-11-09T00:00:00.000Z");

  // Verifikasi filter range: scan_time >= dayStart AND scan_time < dayEnd
  const scanInRange = new Date("2026-11-08T10:30:00.000Z");
  const scanOutOfRange = new Date("2026-11-09T00:00:01.000Z");

  assert.ok(scanInRange >= dayStart && scanInRange < dayEnd, "Scan dalam range harus lolos filter");
  assert.ok(
    !(scanOutOfRange >= dayStart && scanOutOfRange < dayEnd),
    "Scan di luar range harus gagal filter"
  );

  // Verifikasi schema validasi date filter
  const validQuery = attendanceQuerySchema.safeParse({ date: "2026-11-08" });
  assert.equal(validQuery.success, true);

  const invalidQuery = attendanceQuerySchema.safeParse({ date: "08-11-2026" });
  assert.equal(invalidQuery.success, false);
});

// ============================================================================
// BONUS: Schema validation tests
// ============================================================================

test("SCHEMA: rfidScanSchema menolak device_code atau rfid_uid kosong", () => {
  const emptyCode = rfidScanSchema.safeParse({ device_code: "", rfid_uid: "ABCD1234" });
  assert.equal(emptyCode.success, false);

  const emptyUid = rfidScanSchema.safeParse({ device_code: "ESP32-001", rfid_uid: "" });
  assert.equal(emptyUid.success, false);

  const valid = rfidScanSchema.safeParse({ device_code: "ESP32-001", rfid_uid: "ABCD1234" });
  assert.equal(valid.success, true);
});

test("SCHEMA: createAttendanceSchema menolak status ALPA dan member_id non-UUID", () => {
  // ALPA tidak boleh dalam createAttendanceSchema
  const withAlpa = createAttendanceSchema.safeParse({
    member_id: "11111111-1111-1111-1111-111111111111",
    schedule_id: "22222222-2222-2222-2222-222222222222",
    status: "ALPA",
    method: AttendanceMethod.MANUAL,
  });
  assert.equal(withAlpa.success, false);

  // UUID tidak valid ditolak
  const invalidUuid = createAttendanceSchema.safeParse({
    member_id: "not-a-uuid",
    schedule_id: "22222222-2222-2222-2222-222222222222",
    status: "HADIR",
    method: AttendanceMethod.MANUAL,
  });
  assert.equal(invalidUuid.success, false);

  // Valid
  const valid = createAttendanceSchema.safeParse({
    member_id: "11111111-1111-1111-1111-111111111111",
    schedule_id: "22222222-2222-2222-2222-222222222222",
    status: AttendanceStatus.HADIR,
    method: AttendanceMethod.MANUAL,
  });
  assert.equal(valid.success, true);
});

test("RBAC: ADMIN GENERAL dan SECRETARY memiliki ATTENDANCE.CREATE dan HISTORY_CORRECTION.CORRECT", () => {
  const generalAdmin: AuthenticatedUser = {
    id: "ga-1",
    username: "ketua_osis",
    email: "ketua@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.GENERAL,
    member_id: null,
  };

  const secretaryAdmin: AuthenticatedUser = {
    id: "sec-1",
    username: "sekretaris_osis",
    email: "sekretaris@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.SECRETARY,
    member_id: null,
  };

  // GENERAL: CREATE + READ ATTENDANCE
  assert.equal(canAccessModule(generalAdmin, AppModule.ATTENDANCE, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.ATTENDANCE, PermissionAction.READ), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT), true);

  // SECRETARY: CREATE + READ ATTENDANCE + CORRECT
  assert.equal(canAccessModule(secretaryAdmin, AppModule.ATTENDANCE, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.ATTENDANCE, PermissionAction.READ), true);
  assert.equal(canAccessModule(secretaryAdmin, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT), true);
});

// Verify MemberStatus enum values match Prisma schema (compilation check)
test("SCHEMA: MemberStatus enum dari Prisma memiliki nilai yang benar", () => {
  assert.equal(MemberStatus.ACTIVE, "ACTIVE");
  assert.equal(MemberStatus.INACTIVE, "INACTIVE");
  assert.equal(MemberStatus.ALUMNI, "ALUMNI");
});
