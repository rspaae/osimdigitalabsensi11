import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { AppModule, PermissionAction } from "@/types/auth";
import { getAttendanceById } from "@/lib/services/attendance.service";
import { NotFoundError } from "@/lib/services/errors";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/utils/attendance-status";
import CorrectionForm from "./CorrectionForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Koreksi Absensi | OSIS MPK SMKN 11 BANDUNG",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

type AttendanceDetail = Awaited<ReturnType<typeof getAttendanceById>>;

export default async function CorrectionPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const canCorrect = canAccessModule(
    user,
    AppModule.HISTORY_CORRECTION,
    PermissionAction.CORRECT
  );

  let attendance: AttendanceDetail;
  try {
    attendance = await getAttendanceById(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const scanWib = getWibDateComponents(attendance.scan_time);
  const lastScanWib = getWibDateComponents(attendance.last_scan_at);
  const upgradedWib = attendance.auto_upgraded_at
    ? getWibDateComponents(attendance.auto_upgraded_at)
    : null;
  const startWib = getWibDateComponents(attendance.schedule.start_time);
  const cutoffWib = getWibDateComponents(attendance.schedule.late_threshold);
  const sessionDate = attendance.schedule.date.toISOString().slice(0, 10);

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/dashboard/attendance" className="breadcrumb-link">Rekap presensi</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Koreksi</span>
        </nav>
        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Koreksi Absensi</h1>
          <span className="settings-role-badge">{user.role}</span>
        </div>
        <p className="settings-page-desc">
          Perubahan status wajib disertai alasan dan otomatis tercatat di audit log
          (siapa, kapan, status lama, status baru).
        </p>
      </header>

      <div className="settings-page-body">
        {!canCorrect ? (
          <section className="cycle-form-card">
            <h2 className="cycle-section-title">Akses ditolak</h2>
            <p className="cycle-form-description">
              Peran <strong>{user.role}</strong> tidak memiliki izin
              <code> HISTORY_CORRECTION.CORRECT</code>. Hubungi Superadmin bila
              Anda memang perlu melakukan koreksi.
            </p>
            <Link href="/dashboard/attendance" className="member-secondary-link">
              ← Kembali ke rekap presensi
            </Link>
          </section>
        ) : (
          <div className="correction-layout">
            <section className="cycle-status-card">
              <h2 className="cycle-section-title">Detail Absensi</h2>

              <div className="correction-grid">
                <div className="correction-item">
                  <span className="cycle-label">Nama anggota</span>
                  <span className="cycle-value">{attendance.member.full_name}</span>
                  <span className="correction-sub">
                    {attendance.member.nis ? `NIS ${attendance.member.nis}` : "NIS belum diisi"}
                  </span>
                </div>
                <div className="correction-item">
                  <span className="cycle-label">Kegiatan</span>
                  <span className="cycle-value">{attendance.schedule.activity.name}</span>
                  <span className="correction-sub">Sesi {sessionDate}</span>
                </div>
                <div className="correction-item">
                  <span className="cycle-label">Jendela piket</span>
                  <span className="cycle-value">
                    {startWib.timeStr}–{cutoffWib.timeStr} WIB
                  </span>
                  <span className="correction-sub">Batas tepat waktu {cutoffWib.timeStr} WIB</span>
                </div>
                <div className="correction-item">
                  <span className="cycle-label">Status saat ini</span>
                  <span className="cycle-value">
                    {ATTENDANCE_STATUS_LABEL[attendance.status] ?? attendance.status}
                  </span>
                  <span className="correction-sub">
                    Metode {attendance.method === "RFID" ? "RFID" : "Manual"}
                    {attendance.is_substitution ? " · pengganti" : ""}
                  </span>
                </div>
                <div className="correction-item">
                  <span className="cycle-label">Scan pertama</span>
                  <span className="cycle-value">{scanWib.timeWithSecondsStr} WIB</span>
                  <span className="correction-sub">Tanggal {scanWib.dateStr}</span>
                </div>
                <div className="correction-item">
                  <span className="cycle-label">Jumlah tap</span>
                  <span className="cycle-value">{attendance.scan_count}×</span>
                  <span className="correction-sub">
                    Terakhir {lastScanWib.timeWithSecondsStr} WIB
                  </span>
                </div>
              </div>

              {upgradedWib && (
                <p className="correction-note">
                  Status dinaikkan otomatis ke HADIR pada {upgradedWib.timeWithSecondsStr} WIB
                  karena tap ulang terjadi di dalam jendela piket.
                </p>
              )}

              {attendance.notes && (
                <p className="correction-note">
                  <strong>Catatan saat ini:</strong> {attendance.notes}
                </p>
              )}
            </section>

            <section className="cycle-form-card">
              <h2 className="cycle-section-title">Form Koreksi</h2>
              <CorrectionForm
                attendanceId={attendance.id}
                currentStatus={attendance.status}
                currentNotes={attendance.notes}
              />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
