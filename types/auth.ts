import { Role, AdminScope } from "@prisma/client";

export { Role, AdminScope };

/**
 * Payload data yang disimpan di dalam signed session JWT cookie
 */
export interface SessionPayload {
  sub: string; // User ID
  username: string;
  email: string;
  role: Role;
  admin_scope: AdminScope | null;
  member_id: string | null;
  iat?: number;
  exp?: number;
}

/**
 * Representasi aman user context terotentikasi (bebas password_hash)
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  admin_scope: AdminScope | null;
  member_id: string | null;
}

/**
 * 13 Modul aplikasi sesuai blueprint resmi docs/architecture.md
 */
export enum AppModule {
  AUTH_SESSIONS = "AUTH_SESSIONS",
  DASHBOARD = "DASHBOARD",
  MEMBERS = "MEMBERS",
  EXECUTIVES = "EXECUTIVES",
  DIVISIONS = "DIVISIONS",
  ACTIVITIES = "ACTIVITIES",
  SCHEDULES = "SCHEDULES",
  ATTENDANCE = "ATTENDANCE",
  HISTORY_CORRECTION = "HISTORY_CORRECTION",
  VIOLATIONS = "VIOLATIONS",
  REPORTS = "REPORTS",
  SYSTEM_SETTINGS = "SYSTEM_SETTINGS",
  IOT_DEVICES = "IOT_DEVICES",
}

/**
 * Tipe aksi operasional perizinan
 */
export enum PermissionAction {
  CREATE = "CREATE",
  READ = "READ",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  EXPORT = "EXPORT",
  CORRECT = "CORRECT",
  MANAGE_SESSION = "MANAGE_SESSION",
}
