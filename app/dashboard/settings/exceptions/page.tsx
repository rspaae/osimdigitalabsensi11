import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreshUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { listScheduleExceptions } from "@/lib/services/schedule-exception.service";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import ScheduleExceptionForm from "./ScheduleExceptionForm";
import DeleteExceptionButton from "./DeleteExceptionButton";

export const instant = false;

export const metadata: Metadata = {
  title: "Kalender Libur | OSIS MPK SMKN 11 BANDUNG",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function shiftDate(dateStr: string, days: number): string {
  return new Date(parseDateOnlyToUtc(dateStr).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export default async function ScheduleExceptionsPage() {
  const user = await getFreshUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/dashboard");

  const { dateStr: todayWib } = getWibDateComponents(new Date());
  const from = shiftDate(todayWib, -30);
  const to = shiftDate(todayWib, 120);

  const [activities, exceptions] = await Promise.all([
    prisma.activity.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listScheduleExceptions({ from, to }),
  ]);

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/dashboard/settings/cycle" className="breadcrumb-link">Pengaturan</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Kalender libur</span>
        </nav>

        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Kalender Libur Piket</h1>
          <span className="settings-role-badge">SUPERADMIN</span>
        </div>
        <p className="settings-page-desc">
          Tandai tanggal ketika piket ditiadakan (libur nasional, kegiatan sekolah, atau
          kondisi mendadak). Pada tanggal tersebut scan RFID akan ditolak dengan pesan
          “kegiatan libur” dan tidak ada sesi absensi yang dibuat.
        </p>
      </header>

      <div className="settings-page-body">
        <section className="member-form-card" aria-labelledby="exception-form-title">
          <h2 className="cycle-section-title" id="exception-form-title">Tambah pengecualian</h2>
          <p className="cycle-form-description">
            Pilih satu tanggal atau rentang tanggal. Biarkan kegiatan “Semua kegiatan” bila
            Sapa Pagi dan Danusan sama-sama libur. Mengulang tanggal yang sama akan
            memperbarui alasannya.
          </p>
          <ScheduleExceptionForm date={todayWib} activities={activities} />
        </section>

        <section className="member-list-card" aria-labelledby="exception-list-title">
          <div className="member-list-heading">
            <div>
              <h2 className="cycle-section-title" id="exception-list-title">
                Daftar libur ({from} s.d. {to})
              </h2>
              <p className="cycle-form-description">
                Menampilkan pengecualian 30 hari terakhir hingga 120 hari ke depan.
              </p>
            </div>
          </div>

          {exceptions.length === 0 ? (
            <p className="member-empty-state">Belum ada tanggal yang ditandai libur.</p>
          ) : (
            <div className="member-table-wrap">
              <table className="member-table table-stack">
                <thead>
                  <tr>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Kegiatan</th>
                    <th scope="col">Alasan</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((item) => {
                    const label = dateFormatter.format(parseDateOnlyToUtc(item.date));
                    return (
                      <tr key={item.id}>
                        <td data-label="Tanggal">{label}</td>
                        <td data-label="Kegiatan">{item.activity_name ?? "Semua kegiatan"}</td>
                        <td data-label="Alasan">{item.reason}</td>
                        <td data-label="Aksi">
                          <DeleteExceptionButton
                            id={item.id}
                            label={`${item.activity_name ?? "semua kegiatan"} pada ${item.date}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
