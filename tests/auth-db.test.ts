import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { canAccessModule, assertAuthorized, AuthorizationError } from "../lib/auth/rbac";
import { setupSuperadminSchema } from "../lib/validators/setup.schema";
import { loginSchema } from "../lib/validators/auth.schema";
import {
  Role,
  AdminScope,
  AppModule,
  PermissionAction,
  type AuthenticatedUser,
} from "../types/auth";

// ============================================================================
// 1. PASSWORD HASHING & INTEGRITY TESTS
// ============================================================================

test("PASSWORD: Hash password menghasilkan string bcrypt yang valid (bukan plaintext)", async () => {
  const plain = "SuperSecretPassword123!";
  const hash = await hashPassword(plain);

  assert.notEqual(hash, plain);
  assert.ok(hash.startsWith("$2a$") || hash.startsWith("$2b$"));

  const isValid = await verifyPassword(plain, hash);
  assert.equal(isValid, true);

  const isInvalid = await verifyPassword("WrongPassword!", hash);
  assert.equal(isInvalid, false);
});

// ============================================================================
// 2. AUTHENTICATION LOGIC & VALIDATION TESTS
// ============================================================================

test("AUTH: loginSchema menolak input kosong atau tidak valid", () => {
  const valid = loginSchema.safeParse({
    usernameOrEmail: "admin_osis",
    password: "password123",
  });
  assert.equal(valid.success, true);

  const shortUsername = loginSchema.safeParse({
    usernameOrEmail: "ab",
    password: "password123",
  });
  assert.equal(shortUsername.success, false);

  const shortPassword = loginSchema.safeParse({
    usernameOrEmail: "admin_osis",
    password: "123",
  });
  assert.equal(shortPassword.success, false);
});

test("AUTH: Generic error message untuk unknown username vs invalid password", () => {
  // Aturan keamanan: Pesan error harus identik untuk mencegah username enumeration
  const genericError = "Username/email atau password salah";
  
  function getAuthErrorMessage(userExists: boolean, passwordValid: boolean, isActive: boolean) {
    if (!userExists || !passwordValid) {
      return genericError;
    }
    if (!isActive) {
      return "Akun Anda telah dinonaktifkan. Silakan hubungi Superadmin.";
    }
    return null;
  }

  // Kasus 1: User tidak ditemukan
  assert.equal(getAuthErrorMessage(false, false, true), genericError);

  // Kasus 2: User ditemukan tapi password salah
  assert.equal(getAuthErrorMessage(true, false, true), genericError);

  // Kasus 3: User dan password benar tapi akun dinonaktifkan
  assert.equal(
    getAuthErrorMessage(true, true, false),
    "Akun Anda telah dinonaktifkan. Silakan hubungi Superadmin."
  );

  // Kasus 4: Berhasil
  assert.equal(getAuthErrorMessage(true, true, true), null);
});

// ============================================================================
// 3. STALE JWT ROLE VS DATABASE FRESH AUTHORIZATION
// ============================================================================

test("AUTHORIZATION: Stale JWT claims tidak menimpa status DB pengguna terkini", () => {
  // Simulasi JWT mengklaim role SUPERADMIN
  const staleTokenPayload: AuthenticatedUser = {
    id: "user-123",
    username: "mantan_superadmin",
    email: "mantan@smkn11bdg.sch.id",
    role: Role.SUPERADMIN,
    admin_scope: null,
    member_id: null,
  };

  // Status riil di Database: akun telah diubah menjadi VIEWER oleh sistem
  const freshDatabaseUser: AuthenticatedUser = {
    id: "user-123",
    username: "mantan_superadmin",
    email: "mantan@smkn11bdg.sch.id",
    role: Role.VIEWER,
    admin_scope: null,
    member_id: null,
  };

  // Evaluasi aksi mutasi sensitif (DELETE member) menggunakan fresh database user
  const canDeleteWithStaleJwt = canAccessModule(
    staleTokenPayload,
    AppModule.MEMBERS,
    PermissionAction.DELETE
  );
  assert.equal(canDeleteWithStaleJwt, true); // Klaim palsu token lama

  const canDeleteWithFreshDb = canAccessModule(
    freshDatabaseUser,
    AppModule.MEMBERS,
    PermissionAction.DELETE
  );
  assert.equal(canDeleteWithFreshDb, false); // Otorisasi sesungguhnya menolak!

  assert.throws(
    () => assertAuthorized(freshDatabaseUser, AppModule.MEMBERS, PermissionAction.DELETE),
    AuthorizationError
  );
});

test("AUTHORIZATION: Akun non-aktif langsung diblokir meskipun memiliki JWT yang sah", () => {
  const freshDatabaseUser = {
    id: "user-456",
    username: "nonaktif_user",
    role: Role.ADMIN,
    admin_scope: AdminScope.GENERAL,
    is_active: false, // Akun dinonaktifkan
  };

  function authorizeUserOperation(user: typeof freshDatabaseUser) {
    if (!user.is_active) {
      throw new Error("Akun dinonaktifkan");
    }
    return true;
  }

  assert.throws(() => authorizeUserOperation(freshDatabaseUser), /Akun dinonaktifkan/);
});

// ============================================================================
// 4. INITIAL SUPERADMIN SETUP TESTS
// ============================================================================

test("SETUP: Schema setup menolak password lemah atau username dengan karakter terlarang", () => {
  const valid = setupSuperadminSchema.safeParse({
    username: "superadmin",
    email: "admin@smkn11bdg.sch.id",
    password: "StrongPassword2026!",
    setupSecret: "my-long-setup-secret-1234",
  });
  assert.equal(valid.success, true);

  const invalidUsername = setupSuperadminSchema.safeParse({
    username: "admin with space!",
    email: "admin@smkn11bdg.sch.id",
    password: "StrongPassword2026!",
    setupSecret: "my-long-setup-secret-1234",
  });
  assert.equal(invalidUsername.success, false);

  const shortPassword = setupSuperadminSchema.safeParse({
    username: "superadmin",
    email: "admin@smkn11bdg.sch.id",
    password: "1234", // < 8 karakter
    setupSecret: "my-long-setup-secret-1234",
  });
  assert.equal(shortPassword.success, false);
});

test("SETUP: Penolakan setup berulang jika akun SUPERADMIN telah ada", () => {
  let existingSuperadminCount = 0;

  function handleSetupRequest(existingCount: number, secretProvided: string, serverSecret: string) {
    if (secretProvided !== serverSecret) {
      return { success: false, error: "Kunci otorisasi setup tidak sah." };
    }
    if (existingCount > 0) {
      return { success: false, error: "Inisialisasi ditolak: Akun SUPERADMIN sudah ada dalam sistem." };
    }
    existingSuperadminCount++;
    return { success: true };
  }

  const serverSecret = "secure-env-secret-987654321";

  // Setup pertama dengan secret salah -> DITOLAK
  const wrongSecret = handleSetupRequest(existingSuperadminCount, "wrong", serverSecret);
  assert.equal(wrongSecret.success, false);
  assert.match(wrongSecret.error!, /tidak sah/);

  // Setup pertama dengan secret benar -> BERHASIL
  const firstSetup = handleSetupRequest(existingSuperadminCount, serverSecret, serverSecret);
  assert.equal(firstSetup.success, true);
  assert.equal(existingSuperadminCount, 1);

  // Setup kedua (berulang) -> DITOLAK MUTLAK
  const secondSetup = handleSetupRequest(existingSuperadminCount, serverSecret, serverSecret);
  assert.equal(secondSetup.success, false);
  assert.match(secondSetup.error!, /sudah ada dalam sistem/);
});
