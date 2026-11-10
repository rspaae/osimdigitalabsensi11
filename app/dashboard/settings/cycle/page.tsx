import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { getCycleStatus } from "@/lib/services/duty.service";
import CycleSettingsForm from "./CycleSettingsForm";
import type { Metadata } from "next";
import Link from "next/link";

// Membaca cookie sesi — tidak bisa di-prerender
export const instant = false;

export const metadata: Metadata = {
  title: "Pengaturan Siklus | OSIS MPK SMKN 11 BANDUNG",
};

export default async function CycleSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  // Ambil status siklus dari service (server-side)
  let cycleStatus;
  try {
    cycleStatus = await getCycleStatus();
  } catch {
    cycleStatus = {
      configured: false,
      cycle_start_date: null,
      current_wib: {
        dateStr: "-",
        timeStr: "-",
        dayOfWeek: "-",
        timeWithSecondsStr: "-",
        wibDate: new Date(),
      },
    };
  }

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">
            Dashboard
          </Link>
          <span className="breadcrumb-sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumb-current">Pengaturan Siklus</span>
        </nav>

        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Pengaturan Siklus 14 Hari</h1>
          <span className="settings-role-badge">SUPERADMIN</span>
        </div>

        <p className="settings-page-desc">
          Kelola konfigurasi siklus absensi piket dua mingguan (Minggu 1 &amp;
          Minggu 2). Tanggal mulai siklus menentukan rotasi jadwal RFID
          otomatis.
        </p>
      </header>

      <div className="settings-page-body">
        <CycleSettingsForm initialStatus={cycleStatus} />
      </div>
    </main>
  );
}
