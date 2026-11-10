import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

import {
  createSessionToken,
  verifySessionToken,
  getSecretKey,
} from "../lib/auth/session";

import {
  canAccessModule,
  assertAuthorized,
  assertRole,
  AuthorizationError,
} from "../lib/auth/rbac";

import {
  sanitizeRedirectUrl,
  validateRequestOrigin,
} from "../lib/auth/security";

import {
  Role,
  AdminScope,
  AppModule,
  PermissionAction,
} from "../types/auth";

// ============================================================================
// 1. JWT & SESSION SECURITY TESTS
// ============================================================================

test("JWT: Verifikasi token valid berhasil mengembalikan payload", async () => {
  const token = await createSessionToken({
    sub: "test-user-123",
    username: "admin_test",
    email: "admin@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.GENERAL,
    member_id: "member-123",
  });

  assert.ok(token);
  const payload = await verifySessionToken(token);
  assert.ok(payload);
  assert.equal(payload.sub, "test-user-123");
  assert.equal(payload.username, "admin_test");
  assert.equal(payload.role, Role.ADMIN);
  assert.equal(payload.admin_scope, AdminScope.GENERAL);
  assert.equal(payload.member_id, "member-123");
});

test("JWT: Menolak token palsu atau rusak (malformed / tampered)", async () => {
  const resultMalformed = await verifySessionToken("bukan.token.jwt");
  assert.equal(resultMalformed, null);

  const validToken = await createSessionToken({
    sub: "user-1",
    username: "user1",
    email: "u1@test.com",
    role: Role.ADMIN,
    admin_scope: null,
    member_id: null,
  });

  // Rusak tanda tangan token
  const tamperedToken = validToken.slice(0, -6) + "xxxxxx";
  const resultTampered = await verifySessionToken(tamperedToken);
  assert.equal(resultTampered, null);
});

test("JWT: Menolak token yang telah kedaluwarsa (expired token)", async () => {
  const secret = getSecretKey();

  // Buat token yang sudah kedaluwarsa 10 detik lalu
  const expiredToken = await new SignJWT({
    sub: "expired-user",
    username: "expired",
    email: "exp@test.com",
    role: Role.ADMIN,
    admin_scope: null,
    member_id: null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
    .sign(secret);

  const payload = await verifySessionToken(expiredToken);
  assert.equal(payload, null);
});

test("AUTH_SECRET: Gagal seketika jika AUTH_SECRET tidak ada atau kurang dari 32 karakter", () => {
  const originalSecret = process.env.AUTH_SECRET;

  try {
    // Uji jika kosong
    process.env.AUTH_SECRET = "";
    assert.throws(
      () => getSecretKey(),
      /SECURITY ERROR: AUTH_SECRET must be configured/
    );

    // Uji jika pendek (< 32 karakter)
    process.env.AUTH_SECRET = "short-secret-key-123";
    assert.throws(
      () => getSecretKey(),
      /SECURITY ERROR: AUTH_SECRET must be configured/
    );
  } finally {
    // Kembalikan secret asli
    process.env.AUTH_SECRET = originalSecret;
  }
});

// ============================================================================
// 2. ROLE & ADMINSCOPE AUTHORIZATION TESTS
// ============================================================================

test("RBAC: SUPERADMIN memiliki hak akses penuh ke seluruh modul dan aksi", () => {
  const superadmin = { role: Role.SUPERADMIN, admin_scope: null };

  assert.equal(
    canAccessModule(superadmin, AppModule.SYSTEM_SETTINGS, PermissionAction.UPDATE),
    true
  );
  assert.equal(
    canAccessModule(superadmin, AppModule.IOT_DEVICES, PermissionAction.CREATE),
    true
  );
  assert.equal(
    canAccessModule(superadmin, AppModule.MEMBERS, PermissionAction.DELETE),
    true
  );
});

test("RBAC: VIEWER dibatasi secara ketat hanya READ dan EXPORT pada modul pantauan", () => {
  const viewer = { role: Role.VIEWER, admin_scope: null };

  // Diizinkan membaca
  assert.equal(canAccessModule(viewer, AppModule.DASHBOARD, PermissionAction.READ), true);
  assert.equal(canAccessModule(viewer, AppModule.ATTENDANCE, PermissionAction.READ), true);
  assert.equal(canAccessModule(viewer, AppModule.REPORTS, PermissionAction.READ), true);
  assert.equal(canAccessModule(viewer, AppModule.REPORTS, PermissionAction.EXPORT), true);

  // Dilarang melakukan mutasi
  assert.equal(canAccessModule(viewer, AppModule.ATTENDANCE, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(viewer, AppModule.MEMBERS, PermissionAction.UPDATE), false);
  assert.equal(canAccessModule(viewer, AppModule.MEMBERS, PermissionAction.DELETE), false);
  assert.equal(canAccessModule(viewer, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), false);
  assert.equal(canAccessModule(viewer, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT), false);

  // Dilarang mengakses modul sistem & IoT
  assert.equal(canAccessModule(viewer, AppModule.SYSTEM_SETTINGS, PermissionAction.READ), false);
  assert.equal(canAccessModule(viewer, AppModule.IOT_DEVICES, PermissionAction.READ), false);
});

test("RBAC: Seluruh ADMIN dilarang mengakses SYSTEM_SETTINGS dan dilarang aksi DELETE", () => {
  const scopes = [
    AdminScope.GENERAL,
    AdminScope.SECRETARY,
    AdminScope.DISCIPLINE_4P,
    AdminScope.TREASURER,
  ];

  for (const scope of scopes) {
    const admin = { role: Role.ADMIN, admin_scope: scope };

    // SYSTEM_SETTINGS mutlak dilarang
    assert.equal(
      canAccessModule(admin, AppModule.SYSTEM_SETTINGS, PermissionAction.READ),
      false,
      `Scope ${scope} tidak boleh membaca SYSTEM_SETTINGS`
    );

    // DELETE mutlak dilarang
    assert.equal(
      canAccessModule(admin, AppModule.MEMBERS, PermissionAction.DELETE),
      false,
      `Scope ${scope} tidak boleh melakukan DELETE`
    );
  }
});

test("RBAC: ADMIN (GENERAL) dapat mengelola modul operasional dan memantau status IoT", () => {
  const generalAdmin = { role: Role.ADMIN, admin_scope: AdminScope.GENERAL };

  assert.equal(canAccessModule(generalAdmin, AppModule.MEMBERS, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.IOT_DEVICES, PermissionAction.READ), true);
  assert.equal(canAccessModule(generalAdmin, AppModule.IOT_DEVICES, PermissionAction.CREATE), false);
});

test("RBAC: ADMIN (SECRETARY) fokus jadwal & presensi, dilarang kelola pelanggaran", () => {
  const secretary = { role: Role.ADMIN, admin_scope: AdminScope.SECRETARY };

  assert.equal(canAccessModule(secretary, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), true);
  assert.equal(canAccessModule(secretary, AppModule.ATTENDANCE, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(secretary, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT), true);
  assert.equal(canAccessModule(secretary, AppModule.REPORTS, PermissionAction.EXPORT), true);

  // Dilarang mengedit atau membuat pelanggaran
  assert.equal(canAccessModule(secretary, AppModule.VIOLATIONS, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(secretary, AppModule.IOT_DEVICES, PermissionAction.READ), false);
});

test("RBAC: ADMIN (DISCIPLINE_4P) fokus pelanggaran, dilarang buka/tutup sesi jadwal", () => {
  const discipline = { role: Role.ADMIN, admin_scope: AdminScope.DISCIPLINE_4P };

  assert.equal(canAccessModule(discipline, AppModule.VIOLATIONS, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(discipline, AppModule.VIOLATIONS, PermissionAction.UPDATE), true);
  assert.equal(canAccessModule(discipline, AppModule.SCHEDULES, PermissionAction.READ), true);

  // Dilarang membuat jadwal atau membuka sesi
  assert.equal(canAccessModule(discipline, AppModule.SCHEDULES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(discipline, AppModule.SCHEDULES, PermissionAction.MANAGE_SESSION), false);
  assert.equal(canAccessModule(discipline, AppModule.HISTORY_CORRECTION, PermissionAction.CORRECT), false);
});

test("RBAC: ADMIN (TREASURER) mengelola jadwal dan absensi khusus Danusan, dilarang kelola pelanggaran", () => {
  const treasurer = { role: Role.ADMIN, admin_scope: AdminScope.TREASURER };

  assert.equal(canAccessModule(treasurer, AppModule.SCHEDULES, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(treasurer, AppModule.ATTENDANCE, PermissionAction.CREATE), true);
  assert.equal(canAccessModule(treasurer, AppModule.REPORTS, PermissionAction.EXPORT), true);

  // Dilarang mengelola pelanggaran
  assert.equal(canAccessModule(treasurer, AppModule.VIOLATIONS, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(treasurer, AppModule.VIOLATIONS, PermissionAction.READ), false);
});

test("RBAC: assertAuthorized dan assertRole melempar AuthorizationError saat akses ditolak", () => {
  const viewerUser = {
    id: "v-1",
    username: "pembina",
    email: "pembina@test.com",
    role: Role.VIEWER,
    admin_scope: null,
    member_id: null,
  };

  assert.throws(
    () => assertAuthorized(viewerUser, AppModule.MEMBERS, PermissionAction.CREATE),
    AuthorizationError
  );

  assert.throws(
    () => assertRole(viewerUser, [Role.SUPERADMIN, Role.ADMIN]),
    AuthorizationError
  );
});

// ============================================================================
// 3. OPEN REDIRECT & CSRF SECURITY TESTS
// ============================================================================

test("SECURITY: sanitizeRedirectUrl menolak open redirect eksternal dan hanya mengizinkan relative path lokal", () => {
  // Path aman
  assert.equal(sanitizeRedirectUrl("/dashboard"), "/dashboard");
  assert.equal(sanitizeRedirectUrl("/schedules/new"), "/schedules/new");
  assert.equal(
    sanitizeRedirectUrl("/attendance/live?filter=today#view"),
    "/attendance/live?filter=today#view"
  );

  // Serangan Open Redirect Eksternal
  assert.equal(sanitizeRedirectUrl("https://evil.com"), "/dashboard");
  assert.equal(sanitizeRedirectUrl("http://evil.com/phishing"), "/dashboard");
  assert.equal(sanitizeRedirectUrl("//evil.com"), "/dashboard");
  assert.equal(sanitizeRedirectUrl("/\\evil.com"), "/dashboard");
  assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), "/dashboard");
  assert.equal(sanitizeRedirectUrl(null), "/dashboard");
  assert.equal(sanitizeRedirectUrl(""), "/dashboard");
  assert.equal(sanitizeRedirectUrl("dashboard"), "/dashboard");
});

test("SECURITY: validateRequestOrigin memvalidasi kecocokan origin header", () => {
  // Request dengan origin cocok
  const validReq = new Request("http://localhost:3000/api/test", {
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  assert.equal(validateRequestOrigin(validReq), true);

  // Request dengan origin tidak cocok (serangan CSRF cross-origin)
  const csrfReq = new Request("http://localhost:3000/api/test", {
    headers: {
      origin: "https://attacker.site",
      host: "localhost:3000",
    },
  });
  assert.equal(validateRequestOrigin(csrfReq), false);
});
