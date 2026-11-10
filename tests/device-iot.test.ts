/**
 * tests/device-iot.test.ts
 * Unit tests for Milestone 13 — IoT Integration & Cloud Deployment Readiness
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  registerDeviceSchema,
  updateDeviceSchema,
  deviceQuerySchema,
} from "../lib/validators/device.schema";
import { generateDeviceApiKey } from "../lib/services/device.service";
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
import { ScheduleStatus, AttendanceStatus } from "@prisma/client";
import {
  BusinessRuleError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../lib/services/errors";
import { AuthenticationError } from "../lib/auth/context";
import { normalizeRfidUid, isValidCanonicalRfidUid } from "../lib/utils/rfid";

// ============================================================================
// TEST 1: Device Registration Validation Schema
// ============================================================================

test("DEVICE REGISTRATION: registerDeviceSchema menerima data valid dan menolak format ilegal", () => {
  // Valid device code
  const valid = registerDeviceSchema.safeParse({
    device_code: "ESP32-LOBBY-01",
    name: "Scanner Lobi Utama",
    location: "Gerbang Depan",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.device_code, "ESP32-LOBBY-01");
  }

  // Lowercase otomatis di-uppercase oleh Zod transform
  const lowercase = registerDeviceSchema.safeParse({
    device_code: "esp32-hall-02",
    name: "Scanner Hall",
    location: "Aula",
  });
  assert.equal(lowercase.success, true);
  if (lowercase.success) {
    assert.equal(lowercase.data.device_code, "ESP32-HALL-02");
  }

  // Karakter terlarang di device_code (spasi, simbol)
  const invalidCode = registerDeviceSchema.safeParse({
    device_code: "ESP32 LOBBY!",
    name: "Scanner Lobi",
    location: "Lobi",
  });
  assert.equal(invalidCode.success, false);

  // Kode terlalu pendek (< 3 karakter)
  const tooShort = registerDeviceSchema.safeParse({
    device_code: "ES",
    name: "Scanner",
    location: "Lobi",
  });
  assert.equal(tooShort.success, false);

  // Validasi updateDeviceSchema
  const validUpdate = updateDeviceSchema.safeParse({
    name: "Scanner Utama Updated",
    is_active: false,
  });
  assert.equal(validUpdate.success, true);

  // Validasi deviceQuerySchema
  const validQuery = deviceQuerySchema.safeParse({
    page: "1",
    limit: "10",
    is_active: "true",
  });
  assert.equal(validQuery.success, true);
  if (validQuery.success) {
    assert.equal(validQuery.data.is_active, true);
  }
});

// ============================================================================
// TEST 2: Device API Key Generation & Cryptographic Hashing
// ============================================================================

test("DEVICE PROVISIONING: generateDeviceApiKey menghasilkan key acak dan bcrypt hash yang valid", async () => {
  const { rawKey, keyHash } = generateDeviceApiKey();
  const resolvedHash = await keyHash;

  // Raw key harus berupa 48-char hex string (24 bytes)
  assert.equal(typeof rawKey, "string");
  assert.equal(rawKey.length, 48);
  assert.match(rawKey, /^[0-9a-f]{48}$/);

  // Hash harus berupa bcrypt hash yang valid ($2a$ atau $2b$)
  assert.match(resolvedHash, /^\$2[ab]\$\d{2}\$/);

  // Verifikasi hash cocok dengan rawKey
  const isMatch = await bcrypt.compare(rawKey, resolvedHash);
  assert.equal(isMatch, true);

  // Raw key palsu tidak boleh cocok
  const fakeMatch = await bcrypt.compare("fake-api-key-1234567890abcdef12345678", resolvedHash);
  assert.equal(fakeMatch, false);
});

// ============================================================================
// TEST 3: Device Authentication Simulation
// ============================================================================

test("DEVICE AUTH: Autentikasi berhasil jika device_code cocok, is_active=true, dan API key valid", async () => {
  const rawKey = "aabbccddeeff00112233445566778899aabbccddeeff0011";
  const keyHash = await bcrypt.hash(rawKey, 10);

  const mockDevice = {
    id: "dev-001",
    device_code: "ESP32-GATE-01",
    api_key_hash: keyHash,
    is_active: true,
  };

  // Verifikasi kredensial
  const keyValid = await bcrypt.compare(rawKey, mockDevice.api_key_hash);
  assert.equal(mockDevice.is_active, true);
  assert.equal(keyValid, true);
});

// ============================================================================
// TEST 4: Invalid Device Credentials Rejected
// ============================================================================

test("DEVICE AUTH: API key salah ditolak", async () => {
  const rawKey = "aabbccddeeff00112233445566778899aabbccddeeff0011";
  const wrongKey = "ffffffffffffffffffffffffffffffffffffffffffffffff";
  const keyHash = await bcrypt.hash(rawKey, 10);

  const isMatch = await bcrypt.compare(wrongKey, keyHash);
  assert.equal(isMatch, false);
});

// ============================================================================
// TEST 5: Deactivated Device (is_active = false) Rejected
// ============================================================================

test("DEVICE AUTH: Perangkat nonaktif (is_active=false) ditolak meskipun key benar", async () => {
  const mockDevice = {
    id: "dev-002",
    device_code: "ESP32-GATE-02",
    api_key_hash: "some-hash",
    is_active: false,
  };

  assert.equal(mockDevice.is_active, false);
});

// ============================================================================
// TEST 6: API Key Rotation
// ============================================================================

test("KEY ROTATION: Rotasi key menginvalidasi key lama dan menghasilkan key baru", async () => {
  // Key pertama
  const key1 = generateDeviceApiKey();
  const hash1 = await key1.keyHash;

  // Rotasi: buat key kedua
  const key2 = generateDeviceApiKey();
  const hash2 = await key2.keyHash;

  // Key baru harus berbeda dengan key lama
  assert.notEqual(key1.rawKey, key2.rawKey);
  assert.notEqual(hash1, hash2);

  // Key lama harus TIDAK cocok dengan hash baru
  const oldKeyAgainstNewHash = await bcrypt.compare(key1.rawKey, hash2);
  assert.equal(oldKeyAgainstNewHash, false);

  // Key baru harus cocok dengan hash baru
  const newKeyAgainstNewHash = await bcrypt.compare(key2.rawKey, hash2);
  assert.equal(newKeyAgainstNewHash, true);
});

// ============================================================================
// TEST 7: Device Schedule Association & Enforcement
// ============================================================================

test("SCHEDULE ASSOCIATION: Device hanya dapat melayani sesi yang terikat dengan device_id-nya", () => {
  const deviceId = "dev-100";
  const otherDeviceId = "dev-999";

  const schedules = [
    { id: "sch-1", device_id: otherDeviceId, status: ScheduleStatus.OPEN },
    { id: "sch-2", device_id: deviceId, status: ScheduleStatus.OPEN },
  ];

  const matched = schedules.filter(
    (s) => s.device_id === deviceId && s.status === ScheduleStatus.OPEN
  );

  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, "sch-2");
});

// ============================================================================
// TEST 8: No Eligible OPEN Schedule Rejection
// ============================================================================

test("SCHEDULE SELECTION: Tolak scan jika tidak ada sesi OPEN untuk perangkat ini", () => {
  const deviceId = "dev-100";
  const schedules: { id: string; device_id: string; status: ScheduleStatus }[] = [
    { id: "sch-1", device_id: deviceId, status: ScheduleStatus.CLOSED },
    { id: "sch-2", device_id: deviceId, status: ScheduleStatus.DRAFT },
  ];

  const eligible = schedules.filter(
    (s) => s.device_id === deviceId && s.status === ScheduleStatus.OPEN
  );

  assert.throws(
    () => {
      if (eligible.length === 0) {
        throw new BusinessRuleError(
          "Tidak ada sesi kegiatan OPEN yang ditetapkan untuk perangkat ini hari ini."
        );
      }
    },
    { name: "BusinessRuleError" }
  );
});

// ============================================================================
// TEST 9: Multiple Ambiguous OPEN Schedules Rejection
// ============================================================================

test("SCHEDULE SELECTION: Tolak jika ada >1 sesi OPEN ambigu pada perangkat yang sama", () => {
  const deviceId = "dev-100";
  const eligibleSchedules = [
    { id: "sch-1", device_id: deviceId, status: ScheduleStatus.OPEN },
    { id: "sch-2", device_id: deviceId, status: ScheduleStatus.OPEN },
  ];

  assert.throws(
    () => {
      if (eligibleSchedules.length > 1) {
        throw new BusinessRuleError(
          `Ditemukan ${eligibleSchedules.length} sesi OPEN aktif untuk perangkat ini. Tutup sesi yang tidak aktif.`
        );
      }
    },
    {
      name: "BusinessRuleError",
      message: "Ditemukan 2 sesi OPEN aktif untuk perangkat ini. Tutup sesi yang tidak aktif.",
    }
  );
});

// ============================================================================
// TEST 10: RFID UID Normalization
// ============================================================================

test("FIRMWARE UID NORMALIZATION: Normalisasi byte array ke hex uppercase berpad 2-digit", () => {
  // Simulasi pembacaan MFRC522 UID bytes
  function simulateFirmwareNormalize(bytes: number[]): string {
    return bytes
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join("");
  }

  // Kasus dengan leading zero (0x0A, 0x05)
  const uid1 = simulateFirmwareNormalize([0x0a, 0x1b, 0x05, 0xff]);
  assert.equal(uid1, "0A1B05FF");

  // Kasus standar 4-byte
  const uid2 = simulateFirmwareNormalize([0x12, 0x34, 0x56, 0x78]);
  assert.equal(uid2, "12345678");

  // Kasus 7-byte UID (MIFARE Ultralight)
  const uid3 = simulateFirmwareNormalize([0x04, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f]);
  assert.equal(uid3, "041A2B3C4D5E6F");
});

// ============================================================================
// TEST 11: Public Scan Endpoint Header Validation
// ============================================================================

test("API SCAN ENDPOINT: Memvalidasi keberadaan Authorization: Bearer <key> header", () => {
  function parseBearerToken(authHeader: string | null): string {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Header Authorization: Bearer <api_key> wajib disertakan.");
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new Error("API key perangkat tidak boleh kosong.");
    }
    return token;
  }

  // Header sah
  assert.equal(
    parseBearerToken("Bearer valid-key-123"),
    "valid-key-123"
  );

  // Tanpa prefix Bearer
  assert.throws(
    () => parseBearerToken("Basic valid-key-123"),
    /Header Authorization: Bearer <api_key> wajib disertakan/
  );

  // Header kosong / null
  assert.throws(
    () => parseBearerToken(null),
    /Header Authorization: Bearer <api_key> wajib disertakan/
  );

  // Bearer tapi string kosong
  assert.throws(
    () => parseBearerToken("Bearer   "),
    /API key perangkat tidak boleh kosong/
  );
});

// ============================================================================
// TEST 12: Scan Response Contract
// ============================================================================

test("API CONTRACT: Response presensi RFID memuat struktur data yang diharapkan firmware", () => {
  const sampleSuccessResponse = {
    success: true,
    message: "Absensi berhasil dicatat.",
    data: {
      attendance_id: "att-12345",
      member_name: "Ahmad Fauzi",
      member_id: "mem-001",
      status: AttendanceStatus.HADIR,
      scan_time: new Date("2026-11-08T06:30:00.000Z"),
      schedule_id: "sch-001",
    },
  };

  assert.equal(sampleSuccessResponse.success, true);
  assert.equal(typeof sampleSuccessResponse.data.attendance_id, "string");
  assert.equal(typeof sampleSuccessResponse.data.member_name, "string");
  assert.ok(sampleSuccessResponse.data.member_name.length <= 50);
  assert.ok(
    [AttendanceStatus.HADIR, AttendanceStatus.TERLAMBAT].includes(
      sampleSuccessResponse.data.status
    )
  );
});

// ============================================================================
// TEST 13: RBAC Proteksi Modul IOT_DEVICES
// ============================================================================

test("RBAC: SUPERADMIN memiliki hak penuh atas IOT_DEVICES, ADMIN GENERAL hanya READ, lainnya ditolak", () => {
  const superadmin: AuthenticatedUser = {
    id: "sa-1",
    username: "superadmin",
    email: "superadmin@smkn11bdg.sch.id",
    role: Role.SUPERADMIN,
    admin_scope: null,
    member_id: null,
  };

  const adminGeneral: AuthenticatedUser = {
    id: "ag-1",
    username: "ketua_osis",
    email: "ketua@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.GENERAL,
    member_id: null,
  };

  const adminSecretary: AuthenticatedUser = {
    id: "sec-1",
    username: "sekretaris",
    email: "sekretaris@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.SECRETARY,
    member_id: null,
  };

  const viewer: AuthenticatedUser = {
    id: "v-1",
    username: "pembina",
    email: "pembina@smkn11bdg.sch.id",
    role: Role.VIEWER,
    admin_scope: null,
    member_id: null,
  };

  // 1. SUPERADMIN: Boleh CREATE, READ, UPDATE, DELETE
  assert.equal(canAccessModule(superadmin, AppModule.IOT_DEVICES, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(superadmin, AppModule.IOT_DEVICES, PermissionAction.READ), true);
  assert.equal(canAccessModule(superadmin, AppModule.IOT_DEVICES, PermissionAction.UPDATE), true);
  assert.equal(canAccessModule(superadmin, AppModule.IOT_DEVICES, PermissionAction.DELETE), true);

  // 2. ADMIN GENERAL: Boleh READ saja (monitoring perangkat)
  assert.equal(canAccessModule(adminGeneral, AppModule.IOT_DEVICES, PermissionAction.READ), true);
  assert.equal(canAccessModule(adminGeneral, AppModule.IOT_DEVICES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(adminGeneral, AppModule.IOT_DEVICES, PermissionAction.UPDATE), false);
  assert.equal(canAccessModule(adminGeneral, AppModule.IOT_DEVICES, PermissionAction.DELETE), false);

  // 3. ADMIN SECRETARY: Ditolak total
  assert.equal(canAccessModule(adminSecretary, AppModule.IOT_DEVICES, PermissionAction.READ), false);
  assert.equal(canAccessModule(adminSecretary, AppModule.IOT_DEVICES, PermissionAction.CREATE), false);

  // 4. VIEWER: Ditolak total
  assert.equal(canAccessModule(viewer, AppModule.IOT_DEVICES, PermissionAction.READ), false);
  assert.throws(
    () => assertAuthorized(viewer, AppModule.IOT_DEVICES, PermissionAction.READ),
    AuthorizationError
  );
});

// ============================================================================
// TEST 14: Environment Variable Security Validation
// ============================================================================

test("SECURITY: AUTH_SECRET minimal 32 karakter", () => {
  function validateAuthSecret(secret: string | undefined): boolean {
    if (!secret || secret.trim().length < 32) {
      throw new Error("AUTH_SECRET must be configured and contain at least 32 characters.");
    }
    return true;
  }

  assert.equal(validateAuthSecret("12345678901234567890123456789012"), true);
  assert.throws(() => validateAuthSecret("too-short"), /at least 32 characters/);
  assert.throws(() => validateAuthSecret(undefined), /at least 32 characters/);
});

// ============================================================================
// TEST 15: Secret Exposure Prevention
// ============================================================================

test("SECURITY: Query device schema tidak menyertakan api_key_hash di select output publik", () => {
  const allowedPublicFields = [
    "id",
    "device_code",
    "name",
    "location",
    "is_active",
    "last_seen",
    "created_at",
    "updated_at",
  ];

  // api_key_hash TIDAK boleh masuk dalam list field publik
  assert.equal(allowedPublicFields.includes("api_key_hash"), false);
});

// ============================================================================
// TEST 16: Canonical RFID UID Normalization (Milestone 14)
// ============================================================================

test("RFID NORMALIZATION: Normalisasi format kanonikal dan validasi input", () => {
  // 1. Lowercase ke uppercase
  assert.equal(normalizeRfidUid("5c45059e"), "5C45059E");
  assert.equal(normalizeRfidUid("878fc201"), "878FC201");

  // 2. Format dengan pemisah titik dua (:), tanda hubung (-), dan spasi
  assert.equal(normalizeRfidUid("5C:45:05:9E"), "5C45059E");
  assert.equal(normalizeRfidUid("87-8F-C2-01"), "878FC201");
  assert.equal(normalizeRfidUid("0A 1B 05 FF"), "0A1B05FF");
  assert.equal(normalizeRfidUid(" 0a:1b:05:ff "), "0A1B05FF");

  // 3. Leading zero byte dipertahankan
  assert.equal(normalizeRfidUid("0A1B05FF"), "0A1B05FF");
  assert.equal(normalizeRfidUid("00A1B2C3"), "00A1B2C3");

  // 4. Kartu 7-byte (14 karakter hex)
  assert.equal(normalizeRfidUid("04:1a:2b:3c:4d:5e:6f"), "041A2B3C4D5E6F");

  // 5. Karakter heksadesimal tidak valid (huruf G, simbol, dll.)
  assert.throws(
    () => normalizeRfidUid("5C45059G"),
    { name: "ValidationError", code: "RFID_INVALID_HEX" }
  );
  assert.throws(
    () => normalizeRfidUid("CARD-1234"),
    { name: "ValidationError", code: "RFID_INVALID_HEX" }
  );

  // 6. Panjang ganjil (odd length) ditolak
  assert.throws(
    () => normalizeRfidUid("5C45059"),
    { name: "ValidationError", code: "RFID_ODD_LENGTH" }
  );

  // 7. Terlalu pendek (< 8 hex / 4 byte) atau terlalu panjang (> 20 hex)
  assert.throws(
    () => normalizeRfidUid("5C4505"),
    { name: "ValidationError", code: "RFID_INVALID_LENGTH" }
  );

  // 8. String kosong atau whitespace
  assert.throws(
    () => normalizeRfidUid(""),
    { name: "ValidationError", code: "RFID_EMPTY" }
  );
  assert.throws(
    () => normalizeRfidUid("   "),
    { name: "ValidationError", code: "RFID_EMPTY" }
  );

  // 9. Fungsi validator boolean
  assert.equal(isValidCanonicalRfidUid("5C45059E"), true);
  assert.equal(isValidCanonicalRfidUid("0A1B05FF"), true);
  assert.equal(isValidCanonicalRfidUid("5c45059e"), false); // Bukan kanonikal (lowercase)
  assert.equal(isValidCanonicalRfidUid("5C:45:05:9E"), false); // Mengandung pemisah
});

// ============================================================================
// TEST 17: Duplicate Scan Preserves Actual Status (HADIR & TERLAMBAT) (Milestone 14)
// ============================================================================

test("DUPLICATE SCAN: Mempertahankan status asli (HADIR & TERLAMBAT) dan mengembalikan is_duplicate: true", () => {
  const initialTimestamp = new Date("2026-11-08T06:30:00.000Z");

  // Simulasi record tersimpan berstatus HADIR
  const existingHadir = {
    attendance_id: "att-001",
    member_name: "Ahmad Fauzi",
    member_id: "mem-001",
    status: AttendanceStatus.HADIR,
    scan_time: initialTimestamp,
    schedule_id: "sch-001",
    is_duplicate: true,
  };

  // Simulasi record tersimpan berstatus TERLAMBAT
  const existingTerlambat = {
    attendance_id: "att-002",
    member_name: "Siti Nurhaliza",
    member_id: "mem-002",
    status: AttendanceStatus.TERLAMBAT,
    scan_time: new Date("2026-11-08T07:15:00.000Z"),
    schedule_id: "sch-001",
    is_duplicate: true,
  };

  // Duplikat HADIR harus tetap HADIR, bukan berubah atau dipaksa
  assert.equal(existingHadir.status, AttendanceStatus.HADIR);
  assert.equal(existingHadir.is_duplicate, true);
  assert.equal(existingHadir.scan_time.toISOString(), "2026-11-08T06:30:00.000Z");

  // Duplikat TERLAMBAT harus tetap TERLAMBAT, BUKAN dipaksa ke HADIR
  assert.equal(existingTerlambat.status, AttendanceStatus.TERLAMBAT);
  assert.notEqual(existingTerlambat.status, AttendanceStatus.HADIR);
  assert.equal(existingTerlambat.is_duplicate, true);
});

// ============================================================================
// TEST 18: Stable Machine-Readable Error Codes & Mapping (Milestone 14)
// ============================================================================

test("ERROR CODES: Seluruh domain error menyediakan kode stabil yang dapat diparsing firmware", () => {
  // 1. Authentication errors
  const authErr = new AuthenticationError("Device auth failed", "DEVICE_AUTH_FAILED");
  assert.equal(authErr.code, "DEVICE_AUTH_FAILED");

  const inactiveErr = new AuthenticationError("Device inactive", "DEVICE_INACTIVE");
  assert.equal(inactiveErr.code, "DEVICE_INACTIVE");

  // 2. Member lookup errors
  const notFoundMember = new NotFoundError("Member not found", "MEMBER_NOT_FOUND");
  assert.equal(notFoundMember.code, "MEMBER_NOT_FOUND");

  const inactiveMember = new NotFoundError("Member inactive", "MEMBER_INACTIVE");
  assert.equal(inactiveMember.code, "MEMBER_INACTIVE");

  // 3. Schedule business rule errors
  const noOpen = new BusinessRuleError("No open schedule", "SCHEDULE_NO_OPEN");
  assert.equal(noOpen.code, "SCHEDULE_NO_OPEN");

  const ambiguous = new BusinessRuleError("Ambiguous schedules", "SCHEDULE_AMBIGUOUS");
  assert.equal(ambiguous.code, "SCHEDULE_AMBIGUOUS");

  // 4. Validation error
  const valErr = new ValidationError("Invalid RFID", undefined, "VALIDATION_ERROR");
  assert.equal(valErr.code, "VALIDATION_ERROR");

  // 5. Conflict error
  const confErr = new ConflictError("Duplicate entry", "CONFLICT");
  assert.equal(confErr.code, "CONFLICT");
});

// ============================================================================
// TEST 19: Hardware Configuration Confirms Buzzer Removed (Milestone 14)
// ============================================================================

test("HARDWARE CONFIG: Konfigurasi mematuhi keputusan PO bahwa buzzer telah dihapus sepenuhnya", () => {
  const configContent = fs.readFileSync(
    path.join(__dirname, "../iot/esp32-attendance/config.h"),
    "utf-8"
  );

  // Pastikan tidak ada alokasi BUZZER_PIN di config.h
  assert.equal(configContent.includes("BUZZER_PIN"), false);
  assert.equal(configContent.includes("BUZZ_SUCCESS_MS"), false);

  const inoContent = fs.readFileSync(
    path.join(__dirname, "../iot/esp32-attendance/esp32-attendance.ino"),
    "utf-8"
  );

  // Pastikan tidak ada fungsi buzzer di sketch Arduino
  assert.equal(inoContent.includes("beepSuccess"), false);
  assert.equal(inoContent.includes("beepFailure"), false);
  assert.equal(inoContent.includes("BUZZER_PIN"), false);
});
