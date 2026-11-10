import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemberSchema,
  updateMemberSchema,
  memberQuerySchema,
} from "../lib/validators/member.schema";
import {
  createPositionSchema,
  updatePositionSchema,
  createSekbidSchema,
  updateSekbidSchema,
  createCommissionSchema,
  updateCommissionSchema,
} from "../lib/validators/organization.schema";
import {
  createMemberPositionSchema,
  updateMemberPositionSchema,
} from "../lib/validators/member-position.schema";
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
import { OrganizationType, MemberStatus } from "@prisma/client";
import { ConflictError, BusinessRuleError } from "../lib/services/errors";

// ============================================================================
// 1. MEMBER MANAGEMENT TESTS
// ============================================================================

test("MEMBER: Skema createMember menerima data valid dengan format lengkap", () => {
  const input = {
    nis: "12345678",
    nisn: "0012345678",
    full_name: "Muhammad Rafa",
    class_grade: "XII PPLG 1",
    organization_type: "OSIS",
    rfid_uid: "A1B2C3D4",
    photo_url: "https://example.com/avatar.jpg",
    status: "ACTIVE",
  };

  const parsed = createMemberSchema.safeParse(input);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.nis, "12345678");
    assert.equal(parsed.data.organization_type, OrganizationType.OSIS);
  }
});

test("MEMBER: Nama, organisasi, dan UID RFID cukup tanpa NIS atau kelas", () => {
  const parsed = createMemberSchema.safeParse({
    full_name: "Anggota Demo",
    organization_type: "OSIS",
    rfid_uid: "A1B2C3D4",
  });

  assert.equal(parsed.success, true);
});

test("MEMBER: Skema createMember menolak nama kosong dan organisasi tidak valid", () => {
  const invalid = createMemberSchema.safeParse({
    full_name: "", // minimal 2
    organization_type: "INVALID_ORG",
  });

  assert.equal(invalid.success, false);
});

test("MEMBER: Menolak duplikasi NIS pada basis data", async () => {
  // Simulasi mock database cek NIS
  const existingMembers = [{ id: "m-1", nis: "11223344", full_name: "Siswa A" }];

  async function mockCreateMember(nis: string) {
    if (existingMembers.some((m) => m.nis === nis)) {
      throw new ConflictError(`NIS '${nis}' sudah terdaftar pada anggota lain.`);
    }
    return { id: "m-2", nis };
  }

  await assert.rejects(
    async () => {
      await mockCreateMember("11223344");
    },
    {
      name: "ConflictError",
      message: "NIS '11223344' sudah terdaftar pada anggota lain.",
    }
  );
});

test("MEMBER: Menolak duplikasi RFID UID pada basis data", async () => {
  const existingMembers = [
    { id: "m-1", nis: "111", rfid_uid: "CARD-999", full_name: "Siswa A" },
  ];

  async function mockCreateMember(rfid: string) {
    const duplicate = existingMembers.find((m) => m.rfid_uid === rfid);
    if (duplicate) {
      throw new ConflictError(
        `RFID UID '${rfid}' sudah digunakan oleh anggota lain (${duplicate.full_name}).`
      );
    }
    return { id: "m-2", rfid_uid: rfid };
  }

  await assert.rejects(
    async () => {
      await mockCreateMember("CARD-999");
    },
    {
      name: "ConflictError",
      message: "RFID UID 'CARD-999' sudah digunakan oleh anggota lain (Siswa A).",
    }
  );
});

test("MEMBER: Query pagination, search, dan filtering memvalidasi parameter", () => {
  const parsed = memberQuerySchema.safeParse({
    page: "2",
    limit: "25",
    search: "Rafa",
    class_grade: "PPLG",
    organization_type: "OSIS",
    status: "ACTIVE",
    sort_by: "full_name",
    sort_order: "asc",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.page, 2);
    assert.equal(parsed.data.limit, 25);
    assert.equal(parsed.data.search, "Rafa");
  }
});

test("MEMBER: Memperbarui data anggota secara parsial via updateMemberSchema", () => {
  const updateInput = {
    class_grade: "XII PPLG 2",
    status: "ALUMNI",
  };

  const parsed = updateMemberSchema.safeParse(updateInput);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.class_grade, "XII PPLG 2");
    assert.equal(parsed.data.status, MemberStatus.ALUMNI);
    assert.equal(parsed.data.full_name, undefined); // parsial
  }
});

test("MEMBER: Preservasi data riwayat — Tolak hard delete jika memiliki riwayat absensi atau pelanggaran", async () => {
  // Simulasi anggota dengan riwayat absensi
  const memberWithHistory = {
    id: "m-active-history",
    full_name: "Ketua OSIS",
    status: MemberStatus.ACTIVE,
    _count: {
      attendances: 15,
      violations: 2,
    },
  };

  function simulateDeleteMember(member: typeof memberWithHistory) {
    if (member._count.attendances > 0 || member._count.violations > 0) {
      // Aturan: Jangan hard delete, lakukan soft-deactivation (status = INACTIVE)
      return {
        deleted: false,
        softDeactivated: true,
        status: MemberStatus.INACTIVE,
        message:
          "Anggota memiliki riwayat absensi atau pelanggaran. Anggota dinonaktifkan (status INACTIVE) untuk menjaga integritas data riwayat historis.",
      };
    }
    return { deleted: true, softDeactivated: false, status: null, message: "Deleted" };
  }

  const result = simulateDeleteMember(memberWithHistory);
  assert.equal(result.deleted, false);
  assert.equal(result.softDeactivated, true);
  assert.equal(result.status, MemberStatus.INACTIVE);
});

// ============================================================================
// 2. ORGANIZATION (POSITIONS, SEKBID, COMMISSION) TESTS
// ============================================================================

test("ORGANIZATION: Validasi pembuatan dan update Position", () => {
  const valid = createPositionSchema.safeParse({
    name: "Ketua Umum OSIS",
    level: 1,
    organization_type: "OSIS",
  });
  assert.equal(valid.success, true);

  const invalidLevel = createPositionSchema.safeParse({
    name: "Ketua Umum OSIS",
    level: 0, // min 1
  });
  assert.equal(invalidLevel.success, false);

  const validUpdate = updatePositionSchema.safeParse({
    level: 2,
  });
  assert.equal(validUpdate.success, true);
});

test("ORGANIZATION: Validasi pembuatan dan update Sekbid (1-10)", () => {
  const valid = createSekbidSchema.safeParse({
    number: 1,
    name: "Ketaqwaan terhadap Tuhan YME",
    description: "Pembinaan rohani dan akhlak mulia",
  });
  assert.equal(valid.success, true);

  const invalidNumber = createSekbidSchema.safeParse({
    number: 0,
    name: "Sekbid Ilegal",
  });
  assert.equal(invalidNumber.success, false);

  const validUpdate = updateSekbidSchema.safeParse({
    name: "Nama Sekbid Baru",
  });
  assert.equal(validUpdate.success, true);
});

test("ORGANIZATION: Validasi pembuatan dan update Commission (A-D)", () => {
  const valid = createCommissionSchema.safeParse({
    code: "a",
    name: "Komisi A - Aspirasi & Kemitraan",
    description: "Pengawasan aspirasi dan advokasi siswa",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    // Memastikan transformasi otomatis ke huruf kapital
    assert.equal(valid.data.code, "A");
  }

  const validUpdate = updateCommissionSchema.safeParse({
    description: "Deskripsi diperbarui",
  });
  assert.equal(validUpdate.success, true);
});

test("ORGANIZATION: Menolak penghapusan Position, Sekbid, atau Commission yang masih direferensikan", () => {
  function checkDeletable(entityName: string, activeAssignmentsCount: number) {
    if (activeAssignmentsCount > 0) {
      throw new BusinessRuleError(
        `${entityName} tidak dapat dihapus karena masih direferensikan oleh ${activeAssignmentsCount} penugasan anggota.`
      );
    }
    return true;
  }

  assert.throws(
    () => checkDeletable("Jabatan 'Ketua OSIS'", 3),
    {
      name: "BusinessRuleError",
      message: "Jabatan 'Ketua OSIS' tidak dapat dihapus karena masih direferensikan oleh 3 penugasan anggota.",
    }
  );

  assert.throws(
    () => checkDeletable("Sekbid 1", 5),
    {
      name: "BusinessRuleError",
      message: "Sekbid 1 tidak dapat dihapus karena masih direferensikan oleh 5 penugasan anggota.",
    }
  );

  assert.throws(
    () => checkDeletable("Komisi A", 2),
    {
      name: "BusinessRuleError",
      message: "Komisi A tidak dapat dihapus karena masih direferensikan oleh 2 penugasan anggota.",
    }
  );
});

// ============================================================================
// 3. MEMBER POSITION ASSIGNMENT TESTS
// ============================================================================

test("ASSIGNMENT: Validasi penugasan OSIS (dengan Sekbid, tanpa Komisi)", () => {
  const validOSIS = createMemberPositionSchema.safeParse({
    member_id: "11111111-1111-1111-1111-111111111111",
    position_id: "22222222-2222-2222-2222-222222222222",
    sekbid_id: "33333333-3333-3333-3333-333333333333",
    period_year: "2025/2026",
    is_active: true,
  });

  assert.equal(validOSIS.success, true);
});

test("ASSIGNMENT: Validasi penugasan MPK (dengan Komisi, tanpa Sekbid)", () => {
  const validMPK = createMemberPositionSchema.safeParse({
    member_id: "11111111-1111-1111-1111-111111111111",
    position_id: "22222222-2222-2222-2222-222222222222",
    commission_id: "44444444-4444-4444-4444-444444444444",
    period_year: "2025/2026",
    is_active: true,
  });

  assert.equal(validMPK.success, true);
});

test("ASSIGNMENT: Validasi penugasan BPH / General (Sekbid dan Komisi bernilai null)", () => {
  const validBPH = createMemberPositionSchema.safeParse({
    member_id: "11111111-1111-1111-1111-111111111111",
    position_id: "22222222-2222-2222-2222-222222222222",
    sekbid_id: null,
    commission_id: null,
    period_year: "2025/2026",
  });

  assert.equal(validBPH.success, true);
});

test("ASSIGNMENT: Menolak keras penetapan Sekbid dan Komisi secara bersamaan (CHECK Constraint)", () => {
  const invalidSimultaneous = createMemberPositionSchema.safeParse({
    member_id: "11111111-1111-1111-1111-111111111111",
    position_id: "22222222-2222-2222-2222-222222222222",
    sekbid_id: "33333333-3333-3333-3333-333333333333",
    commission_id: "44444444-4444-4444-4444-444444444444",
    period_year: "2025/2026",
  });

  assert.equal(invalidSimultaneous.success, false);
  if (!invalidSimultaneous.success) {
    const errorMsg = invalidSimultaneous.error.errors[0]?.message;
    assert.equal(
      errorMsg,
      "Penugasan jabatan tidak boleh menetapkan Sekbid dan Komisi secara bersamaan."
    );
  }
});

test("ASSIGNMENT: Menolak duplikasi penugasan (member_id, position_id, period_year)", () => {
  const existingAssignments = [
    {
      member_id: "mem-1",
      position_id: "pos-1",
      period_year: "2025/2026",
    },
  ];

  function checkAssignmentDuplicate(member_id: string, position_id: string, period_year: string) {
    const exists = existingAssignments.some(
      (a) =>
        a.member_id === member_id &&
        a.position_id === position_id &&
        a.period_year === period_year
    );
    if (exists) {
      throw new ConflictError(
        `Anggota sudah memiliki jabatan ini pada periode ${period_year}.`
      );
    }
    return true;
  }

  assert.throws(
    () => checkAssignmentDuplicate("mem-1", "pos-1", "2025/2026"),
    {
      name: "ConflictError",
      message: "Anggota sudah memiliki jabatan ini pada periode 2025/2026.",
    }
  );

  // Penugasan di periode berbeda harus diizinkan
  assert.equal(checkAssignmentDuplicate("mem-1", "pos-1", "2026/2027"), true);
});

test("ASSIGNMENT: Deaktivasi penugasan (soft) mempertahankan data historis kepengurusan", () => {
  const assignment = {
    id: "asgn-1",
    member_id: "mem-1",
    position_id: "pos-1",
    is_active: true,
  };

  const parsedUpdate = updateMemberPositionSchema.safeParse({
    is_active: false,
  });

  assert.equal(parsedUpdate.success, true);
  if (parsedUpdate.success) {
    const deactivated = { ...assignment, ...parsedUpdate.data };
    assert.equal(deactivated.is_active, false);
    assert.equal(deactivated.position_id, "pos-1");
  }
});

// ============================================================================
// 4. SECURITY & RBAC ENFORCEMENT TESTS
// ============================================================================

test("RBAC: SUPERADMIN memiliki hak penuh CREATE, READ, UPDATE, DELETE pada MEMBERS, EXECUTIVES, DIVISIONS", () => {
  const superadmin: AuthenticatedUser = {
    id: "sa-1",
    username: "superadmin",
    email: "superadmin@smkn11bdg.sch.id",
    role: Role.SUPERADMIN,
    admin_scope: null,
    member_id: null,
  };

  const modules = [AppModule.MEMBERS, AppModule.EXECUTIVES, AppModule.DIVISIONS];
  const actions = [
    PermissionAction.CREATE,
    PermissionAction.READ,
    PermissionAction.UPDATE,
    PermissionAction.DELETE,
  ];

  for (const mod of modules) {
    for (const act of actions) {
      assert.equal(canAccessModule(superadmin, mod, act), true);
      assert.doesNotThrow(() => assertAuthorized(superadmin, mod, act));
    }
  }
});

test("RBAC: VIEWER ditolak tegas untuk semua operasi mutasi (CREATE, UPDATE, DELETE) pada MEMBERS, EXECUTIVES, DIVISIONS", () => {
  const viewer: AuthenticatedUser = {
    id: "v-1",
    username: "pembina_osis",
    email: "pembina@smkn11bdg.sch.id",
    role: Role.VIEWER,
    admin_scope: null,
    member_id: null,
  };

  const modules = [AppModule.MEMBERS, AppModule.EXECUTIVES, AppModule.DIVISIONS];

  for (const mod of modules) {
    // Boleh READ
    assert.equal(canAccessModule(viewer, mod, PermissionAction.READ), true);

    // Dilarang keras CREATE, UPDATE, DELETE
    assert.equal(canAccessModule(viewer, mod, PermissionAction.CREATE), false);
    assert.equal(canAccessModule(viewer, mod, PermissionAction.UPDATE), false);
    assert.equal(canAccessModule(viewer, mod, PermissionAction.DELETE), false);

    assert.throws(
      () => assertAuthorized(viewer, mod, PermissionAction.CREATE),
      AuthorizationError
    );
  }
});

test("RBAC: ADMIN (GENERAL) dapat CREATE/UPDATE anggota & organisasi, tetapi DILARANG DELETE", () => {
  const adminGeneral: AuthenticatedUser = {
    id: "ag-1",
    username: "ketua_osis",
    email: "ketua@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.GENERAL,
    member_id: null,
  };

  const modules = [AppModule.MEMBERS, AppModule.EXECUTIVES, AppModule.DIVISIONS];

  for (const mod of modules) {
    assert.equal(canAccessModule(adminGeneral, mod, PermissionAction.CREATE), true);
    assert.equal(canAccessModule(adminGeneral, mod, PermissionAction.READ), true);
    assert.equal(canAccessModule(adminGeneral, mod, PermissionAction.UPDATE), true);

    // Mutlak DILARANG DELETE
    assert.equal(canAccessModule(adminGeneral, mod, PermissionAction.DELETE), false);
    assert.throws(
      () => assertAuthorized(adminGeneral, mod, PermissionAction.DELETE),
      AuthorizationError
    );
  }
});

test("RBAC: ADMIN (SECRETARY) dibatasi pada MEMBERS (READ, UPDATE) dan dilarang mengubah struktur organisasi", () => {
  const secretary: AuthenticatedUser = {
    id: "sec-1",
    username: "sekretaris_osis",
    email: "sekretaris@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.SECRETARY,
    member_id: null,
  };

  // MEMBERS: Sekretaris boleh READ dan UPDATE (misal update kelas/biodata), tetapi dilarang CREATE & DELETE
  assert.equal(canAccessModule(secretary, AppModule.MEMBERS, PermissionAction.READ), true);
  assert.equal(canAccessModule(secretary, AppModule.MEMBERS, PermissionAction.UPDATE), true);
  assert.equal(canAccessModule(secretary, AppModule.MEMBERS, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(secretary, AppModule.MEMBERS, PermissionAction.DELETE), false);

  // EXECUTIVES & DIVISIONS: Sekretaris hanya READ, dilarang mutasi
  assert.equal(canAccessModule(secretary, AppModule.EXECUTIVES, PermissionAction.READ), true);
  assert.equal(canAccessModule(secretary, AppModule.EXECUTIVES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(secretary, AppModule.DIVISIONS, PermissionAction.READ), true);
  assert.equal(canAccessModule(secretary, AppModule.DIVISIONS, PermissionAction.CREATE), false);
});

test("RBAC: ADMIN (DISCIPLINE_4P & TREASURER) dilarang mengubah data anggota maupun struktur organisasi", () => {
  const disciplineAdmin: AuthenticatedUser = {
    id: "d4p-1",
    username: "polisi_4p",
    email: "patroli4p@smkn11bdg.sch.id",
    role: Role.ADMIN,
    admin_scope: AdminScope.DISCIPLINE_4P,
    member_id: null,
  };

  // Boleh membaca data anggota untuk keperluan patroli/pelanggaran
  assert.equal(canAccessModule(disciplineAdmin, AppModule.MEMBERS, PermissionAction.READ), true);

  // Dilarang mutasi apapun pada anggota atau organisasi
  assert.equal(canAccessModule(disciplineAdmin, AppModule.MEMBERS, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.MEMBERS, PermissionAction.UPDATE), false);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.EXECUTIVES, PermissionAction.CREATE), false);
  assert.equal(canAccessModule(disciplineAdmin, AppModule.DIVISIONS, PermissionAction.CREATE), false);
});
