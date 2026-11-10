"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types/auth";

interface Props { role: Role }

const ITEMS = [
  { href: "/dashboard", label: "Ringkasan", icon: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6" },
  { href: "/dashboard/members", label: "Data anggota", icon: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-7h5m-2.5-2.5v5" },
  { href: "/dashboard/duty/sapa-pagi", label: "Jadwal & roster", icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 10h3m-3 4h7" },
  { href: "/dashboard/settings/cycle", label: "Pengaturan siklus", icon: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/dashboard/devices", label: "Perangkat IoT", icon: "M8 7h8v10H8zM10 3v4m4-4v4m-4 10v4m4-4v4M4 10h4m-4 4h4m8-4h4m-4 4h4" },
];

export default function DashboardNav({ role }: Props) {
  const pathname = usePathname();
  const items = role === "SUPERADMIN" ? ITEMS : ITEMS.slice(0, 1);

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
