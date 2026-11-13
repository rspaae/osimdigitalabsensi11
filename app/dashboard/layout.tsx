import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getFreshUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { logoutAction } from "@/app/actions/auth.actions";
import { AppModule, PermissionAction, type Role } from "@/types/auth";
import DashboardNav from "./DashboardNav";

export const instant = false;

const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  VIEWER: "Pemantau",
};

const ROLE_CAPTION: Record<Role, string> = {
  SUPERADMIN: "Pengurus inti",
  ADMIN: "Pengurus",
  VIEWER: "Pemantau",
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getFreshUser();
  if (!user) redirect("/login");

  const initials = user.username.slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const canViewReports = canAccessModule(
    user,
    AppModule.REPORTS,
    PermissionAction.READ
  );
  const canViewAttendance = canAccessModule(
    user,
    AppModule.ATTENDANCE,
    PermissionAction.READ
  );

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href="/dashboard" className="dashboard-brand" aria-label="OSIS MPK, ke ringkasan">
          <span className="dashboard-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
              <path
                d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2z"
                fill="rgba(255,255,255,0.16)"
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="m8.3 12.1 2.5 2.5 4.9-5.1"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="dashboard-brand-copy">
            <strong>OSIS MPK</strong>
            <small>SMKN 11 BANDUNG</small>
          </span>
        </Link>

        <div className="dashboard-sidebar-divider" />
        <DashboardNav
          role={user.role}
          canViewReports={canViewReports}
          canViewAttendance={canViewAttendance}
        />

        <div className="dashboard-sidebar-footer">
          <div className="dashboard-profile-avatar" aria-hidden="true">{initials}</div>
          <div className="dashboard-profile-copy">
            <strong>{user.username}</strong>
            <span>{roleLabel}</span>
          </div>
          <form action={logoutAction}>
            <button className="dashboard-logout" type="submit" aria-label="Keluar" title="Keluar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3m9-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /></svg>
            </button>
          </form>
        </div>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-topbar-eyebrow">OSIS MPK · SMKN 11 BANDUNG</span>
            <strong>Panel Manajemen</strong>
          </div>
          <div className="dashboard-topbar-user">
            <span className="dashboard-role-pill">{roleLabel}</span>
            <div className="topbar-profile">
              <span className="topbar-avatar" aria-hidden="true">{initials}</span>
              <span className="topbar-profile-copy">
                <strong>{user.username}</strong>
                <small>{ROLE_CAPTION[user.role] ?? "Pengurus"}</small>
              </span>
            </div>
          </div>
        </header>
        <div className="dashboard-main-content">{children}</div>
      </div>
    </div>
  );
}
