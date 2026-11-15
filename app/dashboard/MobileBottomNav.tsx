"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types/auth";
import { logoutAction } from "@/app/actions/auth.actions";

interface Props {
  role: Role;
  canViewReports: boolean;
  canViewAttendance: boolean;
  username: string;
}

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: string;
  adminOnly?: boolean;
  reportsOnly?: boolean;
  attendanceOnly?: boolean;
}

const ALL_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Ringkasan",
    shortLabel: "Home",
    icon: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6",
  },
  {
    href: "/dashboard/attendance",
    label: "Rekap Presensi",
    shortLabel: "Presensi",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4",
    attendanceOnly: true,
  },
  {
    href: "/dashboard/recap",
    label: "Rekap Harian",
    shortLabel: "Rekap",
    icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 10h3m-3 4h7",
    attendanceOnly: true,
  },
  {
    href: "/dashboard/duty/sapa-pagi",
    label: "Jadwal & Roster",
    shortLabel: "Roster",
    icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 10h3m-3 4h7",
    adminOnly: true,
  },
  {
    href: "/dashboard/reports",
    label: "Laporan & Ekspor",
    shortLabel: "Laporan",
    icon: "M4 19h16M7 16V9m5 7V5m5 11v-4",
    reportsOnly: true,
  },
  {
    href: "/dashboard/members",
    label: "Data Anggota",
    shortLabel: "Anggota",
    icon: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-7h5m-2.5-2.5v5",
    adminOnly: true,
  },
  {
    href: "/dashboard/duty/substitutions",
    label: "Tukar Piket",
    shortLabel: "Tukar",
    icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    adminOnly: true,
  },
  {
    href: "/dashboard/settings/cycle",
    label: "Pengaturan Siklus",
    shortLabel: "Siklus",
    icon: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    adminOnly: true,
  },
  {
    href: "/dashboard/settings/exceptions",
    label: "Kalender Libur",
    shortLabel: "Libur",
    icon: "M8 3v3m8-3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2m4 9 2 2 4-4",
    adminOnly: true,
  },
  {
    href: "/dashboard/devices",
    label: "Perangkat IoT",
    shortLabel: "IoT",
    icon: "M8 7h8v10H8zM10 3v4m4-4v4m-4 10v4m4-4v4M4 10h4m-4 4h4m8-4h4m-4 4h4",
    adminOnly: true,
  },
];

export default function MobileBottomNav({
  role,
  canViewReports,
  canViewAttendance,
  username,
}: Props) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filter items sesuai role
  const accessibleItems = ALL_ITEMS.filter((item) => {
    if (item.adminOnly) return role === "SUPERADMIN";
    if (item.reportsOnly) return canViewReports;
    if (item.attendanceOnly) return canViewAttendance;
    return true;
  });

  // 4 Item Utama di Dock
  const primaryHrefs = ["/dashboard", "/dashboard/attendance", "/dashboard/recap", "/dashboard/duty/sapa-pagi"];
  const primaryTabs = accessibleItems.filter((i) => primaryHrefs.includes(i.href)).slice(0, 4);

  // Jika item yang sedang aktif bukan ada di 4 primary tabs, tandai "Menu / Lebih banyak" sebagai aktif
  const isSecondaryActive = accessibleItems
    .filter((i) => !primaryTabs.some((p) => p.href === i.href))
    .some((i) => pathname === i.href || pathname.startsWith(i.href));

  // Tutup bottom sheet saat rute berubah
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Dynamic Floating Dock Bar (Hanya tampil di mobile) */}
      <nav className="mobile-dock" aria-label="Navigasi cepat ponsel">
        {primaryTabs.map((tab) => {
          const isActive = tab.href === "/dashboard" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mobile-dock-btn ${isActive ? "is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="mobile-dock-icon-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={tab.icon} />
                </svg>
                {isActive && <span className="mobile-dock-active-dot" aria-hidden="true" />}
              </div>
              <span className="mobile-dock-label">{tab.shortLabel}</span>
            </Link>
          );
        })}

        {/* Tombol Menu Tambahan / Dynamic Drawer */}
        <button
          type="button"
          className={`mobile-dock-btn ${sheetOpen || isSecondaryActive ? "is-active" : ""}`}
          onClick={() => setSheetOpen((prev) => !prev)}
          aria-expanded={sheetOpen}
          aria-label="Menu selengkapnya"
        >
          <div className="mobile-dock-icon-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {(sheetOpen || isSecondaryActive) && (
              <span className="mobile-dock-active-dot" aria-hidden="true" />
            )}
          </div>
          <span className="mobile-dock-label">Menu</span>
        </button>
      </nav>

      {/* Backdrop Overlay */}
      {sheetOpen && (
        <div
          className="mobile-sheet-backdrop"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dynamic Slide-Up Menu Sheet */}
      <div
        className={`mobile-sheet ${sheetOpen ? "is-open" : ""}`}
        role="dialog"
        aria-label="Menu navigasi lengkap"
        aria-modal="true"
      >
        <div className="mobile-sheet-handle" aria-hidden="true" />

        <div className="mobile-sheet-header">
          <div>
            <span className="mobile-sheet-eyebrow">OSIS MPK SMKN 11</span>
            <h3 className="mobile-sheet-title">Semua Menu &amp; Fitur</h3>
          </div>
          <button
            type="button"
            className="mobile-sheet-close"
            onClick={() => setSheetOpen(false)}
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        <div className="mobile-sheet-grid">
          {accessibleItems.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-sheet-item ${isActive ? "is-active" : ""}`}
                onClick={() => setSheetOpen(false)}
              >
                <span className="mobile-sheet-item-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                </span>
                <span className="mobile-sheet-item-label">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer Profile & Logout */}
        <div className="mobile-sheet-footer">
          <div className="mobile-sheet-user">
            <span className="ui-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
              {username.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong className="mobile-sheet-username">{username}</strong>
              <small className="mobile-sheet-role">{role}</small>
            </div>
          </div>

          <form action={logoutAction}>
            <button type="submit" className="mobile-sheet-logout-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16 }}>
                <path d="M10 17l5-5-5-5M15 12H3m9-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
              </svg>
              Keluar
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
