import {
  Role,
  AdminScope,
  AppModule,
  PermissionAction,
  type AuthenticatedUser,
} from "../../types/auth";

export class AuthorizationError extends Error {
  public code: string;

  constructor(
    message = "Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.",
    code = "FORBIDDEN"
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

/**
 * Matriks otorisasi RBAC & Scope sesuai cetak biru docs/database-design.md
 * Kebijakan: DENIAL BY DEFAULT (jika tidak eksplisit diizinkan, kembalikan false)
 */
export function canAccessModule(
  user: Pick<AuthenticatedUser, "role" | "admin_scope">,
  module: AppModule,
  action: PermissionAction
): boolean {
  // 1. SUPERADMIN memiliki hak akses penuh ke seluruh modul dan aksi
  if (user.role === Role.SUPERADMIN) {
    return true;
  }

  // 2. VIEWER (Pembina) dibatasi secara ketat hanya READ dan EXPORT pada modul monitoring
  if (user.role === Role.VIEWER) {
    // Larangan mutlak mutasi bagi VIEWER
    if (
      action === PermissionAction.CREATE ||
      action === PermissionAction.UPDATE ||
      action === PermissionAction.DELETE ||
      action === PermissionAction.CORRECT ||
      action === PermissionAction.MANAGE_SESSION
    ) {
      return false;
    }

    // Modul yang diizinkan untuk dibaca oleh VIEWER
    const allowedViewerModules = [
      AppModule.DASHBOARD,
      AppModule.MEMBERS,
      AppModule.EXECUTIVES,
      AppModule.DIVISIONS,
      AppModule.ACTIVITIES,
      AppModule.SCHEDULES,
      AppModule.ATTENDANCE,
      AppModule.HISTORY_CORRECTION,
      AppModule.VIOLATIONS,
      AppModule.REPORTS,
    ];

    if (action === PermissionAction.READ) {
      return allowedViewerModules.includes(module);
    }

    if (action === PermissionAction.EXPORT) {
      return module === AppModule.REPORTS;
    }

    return false;
  }

  // 3. ADMIN: Hak akses dibatasi secara ketat berdasarkan AdminScope (Tanggung Jawab)
  if (user.role === Role.ADMIN) {
    // Larangan mutlak: Admin tidak boleh mengakses Pengaturan Sistem global
    if (module === AppModule.SYSTEM_SETTINGS) {
      return false;
    }

    // Larangan mutlak: Admin tidak boleh melakukan aksi DELETE pada master data
    if (action === PermissionAction.DELETE) {
      return false;
    }

    // Khusus IoT Devices: Hanya scope GENERAL yang boleh memantau status perangkat (READ only)
    if (module === AppModule.IOT_DEVICES) {
      return (
        user.admin_scope === AdminScope.GENERAL &&
        action === PermissionAction.READ
      );
    }

    switch (user.admin_scope) {
      case AdminScope.GENERAL:
        // Pimpinan Inti (Ketua/Wakil): Hak operasional menyeluruh
        switch (module) {
          case AppModule.DASHBOARD:
            return action === PermissionAction.READ;
          case AppModule.MEMBERS:
          case AppModule.EXECUTIVES:
          case AppModule.DIVISIONS:
          case AppModule.ACTIVITIES:
            return [
              PermissionAction.CREATE,
              PermissionAction.READ,
              PermissionAction.UPDATE,
            ].includes(action);
          case AppModule.SCHEDULES:
            return [
              PermissionAction.CREATE,
              PermissionAction.READ,
              PermissionAction.UPDATE,
              PermissionAction.MANAGE_SESSION,
            ].includes(action);
          case AppModule.ATTENDANCE:
            return [PermissionAction.CREATE, PermissionAction.READ].includes(
              action
            );
          case AppModule.HISTORY_CORRECTION:
            return [PermissionAction.READ, PermissionAction.CORRECT].includes(
              action
            );
          case AppModule.VIOLATIONS:
            return [
              PermissionAction.CREATE,
              PermissionAction.READ,
              PermissionAction.UPDATE,
            ].includes(action);
          case AppModule.REPORTS:
            return [PermissionAction.READ, PermissionAction.EXPORT].includes(
              action
            );
          default:
            return false;
        }

      case AdminScope.SECRETARY:
        // Sekretaris: Fokus penjadwalan, presensi manual izin/sakit, dan rekapitulasi
        switch (module) {
          case AppModule.DASHBOARD:
            return action === PermissionAction.READ;
          case AppModule.SCHEDULES:
            return [
              PermissionAction.CREATE,
              PermissionAction.READ,
              PermissionAction.UPDATE,
              PermissionAction.MANAGE_SESSION,
            ].includes(action);
          case AppModule.ATTENDANCE:
            return [PermissionAction.CREATE, PermissionAction.READ].includes(
              action
            );
          case AppModule.HISTORY_CORRECTION:
            return [PermissionAction.READ, PermissionAction.CORRECT].includes(
              action
            );
          case AppModule.REPORTS:
            return [PermissionAction.READ, PermissionAction.EXPORT].includes(
              action
            );
          case AppModule.MEMBERS:
            return [PermissionAction.READ, PermissionAction.UPDATE].includes(
              action
            );
          case AppModule.EXECUTIVES:
          case AppModule.DIVISIONS:
          case AppModule.ACTIVITIES:
          case AppModule.VIOLATIONS:
            return action === PermissionAction.READ;
          default:
            return false;
        }

      case AdminScope.DISCIPLINE_4P:
        // Komisi Disiplin / Patroli 4P: Fokus pelanggaran dan monitoring ketertiban
        switch (module) {
          case AppModule.DASHBOARD:
            return action === PermissionAction.READ;
          case AppModule.VIOLATIONS:
            return [
              PermissionAction.CREATE,
              PermissionAction.READ,
              PermissionAction.UPDATE,
            ].includes(action);
          case AppModule.ATTENDANCE:
          case AppModule.SCHEDULES:
          case AppModule.MEMBERS:
          case AppModule.ACTIVITIES:
          case AppModule.HISTORY_CORRECTION:
            return action === PermissionAction.READ;
          case AppModule.REPORTS:
            return [PermissionAction.READ, PermissionAction.EXPORT].includes(
              action
            );
          default:
            return false;
        }

      case AdminScope.TREASURER:
        // Bendahara: Fokus kegiatan Danusan dan logistik
        switch (module) {
          case AppModule.DASHBOARD:
            return action === PermissionAction.READ;
          case AppModule.SCHEDULES:
            return [
              PermissionAction.CREATE,
              PermissionAction.READ,
              PermissionAction.UPDATE,
              PermissionAction.MANAGE_SESSION,
            ].includes(action);
          case AppModule.ATTENDANCE:
            return [PermissionAction.CREATE, PermissionAction.READ].includes(
              action
            );
          case AppModule.REPORTS:
            return [PermissionAction.READ, PermissionAction.EXPORT].includes(
              action
            );
          case AppModule.MEMBERS:
          case AppModule.ACTIVITIES:
          case AppModule.HISTORY_CORRECTION:
            return action === PermissionAction.READ;
          default:
            return false;
        }

      default:
        // Jika admin belum memiliki scope spesifik, default hanya baca dashboard
        return module === AppModule.DASHBOARD && action === PermissionAction.READ;
    }
  }

  // Default DENY untuk role tidak dikenal
  return false;
}

/**
 * Validasi otorisasi server-side. Melempar AuthorizationError jika izin tidak terpenuhi.
 */
export function assertAuthorized(
  user: AuthenticatedUser,
  module: AppModule,
  action: PermissionAction
): void {
  const allowed = canAccessModule(user, module, action);
  if (!allowed) {
    throw new AuthorizationError(
      `Akses ditolak: Akun ${user.role} (${user.admin_scope ?? "NO_SCOPE"}) tidak memiliki izin ${action} pada modul ${module}.`
    );
  }
}

/**
 * Validasi role tertentu. Melempar AuthorizationError jika role tidak cocok.
 */
export function assertRole(user: AuthenticatedUser, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Akses ditolak: Role ${user.role} tidak diizinkan. Dibutuhkan salah satu dari: [${allowedRoles.join(", ")}].`
    );
  }
}
