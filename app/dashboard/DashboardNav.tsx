"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types/auth";

interface Props {
  role: Role;
  /** Ditentukan di server dari matriks RBAC (modul REPORTS). */
  canViewReports: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  reportsOnly?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6" },
  { href: "/dashboard/attendance", label: "Rekap presensi", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" },
  { href: "/dashboard/reports", label: "Laporan & ekspor", icon: "M4 19h16M7 16V9m5 7V5m5 11v-4", reportsOnly: true },
  { href: "/dashboard/members", label: "Data anggota", icon: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-7h5m-2.5-2.5v5", adminOnly: true },
  { href: "/dashboard/duty/sapa-pagi", label: "Jadwal & roster", icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 10h3m-3 4h7", adminOnly: true },
  { href: "/dashboard/settings/cycle", label: "Pengaturan siklus", icon: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", adminOnly: true },
  { href: "/dashboard/settings/exceptions", label: "Kalender libur", icon: "M8 3v3m8-3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2m4 9 2 2 4-4", adminOnly: true },
  { href: "/dashboard/devices", label: "Perangkat IoT", icon: "M8 7h8v10H8zM10 3v4m4-4v4m-4 10v4m4-4v4M4 10h4m-4 4h4m8-4h4m-4 4h4", adminOnly: true },
];

export default function DashboardNav({ role, canViewReports }: Props) {
  const pathname = usePathname();

  const items = ITEMS.filter((item) => {
    if (item.adminOnly) return role === "SUPERADMIN";
    if (item.reportsOnly) return canViewReports;
    return true;
  });

  return (
    <nav className="dashboard-nav" aria-label="Navigasi utama">
      <span className="dashboard-nav-heading">MENU UTAMA</span>
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`dashboard-nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} /></svg>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
