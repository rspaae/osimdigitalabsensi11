import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getFreshUser } from "@/lib/auth/context";
import { logoutAction } from "@/app/actions/auth.actions";
import DashboardNav from "./DashboardNav";

export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getFreshUser();
  if (!user) redirect("/login");

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href="/dashboard" className="dashboard-brand" aria-label="OSIS MPK, ke ringkasan">
          <span className="dashboard-brand-mark">OM</span>
          <span className="dashboard-brand-copy">
            <strong>OSIS MPK</strong>
            <small>SMKN 11 BANDUNG</small>
          </span>
        </Link>

        <div className="dashboard-sidebar-divider" />
        <DashboardNav role={user.role} />

        <div className="dashboard-sidebar-footer">
          <div className="dashboard-profile-avatar" aria-hidden="true">{initials}</div>
          <div className="dashboard-profile-copy">
            <strong>{user.username}</strong>
            <span>{user.role}</span>
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
            <span className="dashboard-topbar-eyebrow">OSIS MPK SMKN 11 BANDUNG</span>
            <strong>Panel Manajemen</strong>
          </div>
          <div className="dashboard-topbar-user">
            <span className="dashboard-role-pill">{user.role}</span>
            <span className="dashboard-topbar-name">{user.username}</span>
          </div>
        </header>
        <div className="dashboard-main-content">{children}</div>
      </div>
    </div>
  );
}
