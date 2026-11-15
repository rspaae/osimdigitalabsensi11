import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { AppModule, PermissionAction } from "@/types/auth";
import { getDailyRecap } from "@/lib/services/daily-recap.service";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { resolveRecapRange } from "@/lib/utils/recap-range";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/utils/attendance-status";

export const instant = false;

export const metadata: Metadata = {
  title: "Rekap Harian | OSIS MPK SMKN 11 BANDUNG",
};

const dayHeading = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateHeading = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
  day: "numeric",
  month: "short",
});

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function DailyRecapPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user, AppModule.ATTENDANCE, PermissionAction.READ)) {
    redirect("/dashboard");
  }

  const { dateStr: todayWib } = getWibDateComponents(new Date());
  const params = await searchParams;
  const range = resolveRecapRange({
    from: params.from,
    to: params.to,
    today: todayWib,
  });

  const days = await getDailyRecap({ from: range.from, to: range.to });
  const orderedDays = [...days].reverse();

  const totalRecorded = days.reduce((total, day) => total + day.recordedCount, 0);
  const totalAbsent = days.reduce((total, day) => total + day.absentCount, 0);
  const totalCombined = totalRecorded + totalAbsent;
  const overallRate = totalCombined > 0 ? Math.round((totalRecorded / totalCombined) * 100) : 0;

  return (
    <main className="settings-page recap-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/dashboard/attendance" className="breadcrumb-link">Rekap presensi</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Rekap harian</span>
        </nav>

        <div className="settings-page-title-row">
          <div>
            <h1 className="settings-page-title">Rekap Presensi Harian</h1>
            <p className="settings-page-desc" style={{ marginTop: 4 }}>
              Ringkasan data presensi dan status kehadiran piket siswa per tanggal.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/dashboard/attendance" className="overview-secondary-action">
              &larr; Log Presensi Realtime
            </Link>
          </div>
        </div>
      </header>

      <div className="settings-page-body recap-body">
        {/* Metric Cards Ringkasan */}
        <section className="ui-stats-grid" aria-label="Statistik Periode">
          <article className="ui-stat-card accent-indigo">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Periode Waktu</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">📅</span>
            </div>
            <div className="ui-stat-value">{days.length} <span style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>hari</span></div>
            <div className="ui-stat-desc">{range.from} s/d {range.to}</div>
          </article>

          <article className="ui-stat-card accent-mint">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Total Hadir</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">✓</span>
            </div>
            <div className="ui-stat-value" style={{ color: "#059669" }}>{totalRecorded}</div>
            <div className="ui-stat-desc">Siswa hadir / presensi tercatat</div>
          </article>

          <article className="ui-stat-card accent-amber">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Belum Absen</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">⚠️</span>
            </div>
            <div className="ui-stat-value" style={{ color: "#d97706" }}>{totalAbsent}</div>
            <div className="ui-stat-desc">Petugas terjadwal belum scan</div>
          </article>

          <article className="ui-stat-card accent-sky">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Tingkat Kehadiran</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">📈</span>
            </div>
            <div className="ui-stat-value" style={{ color: "#0284c7" }}>{overallRate}%</div>
            <div className="ui-stat-desc">
              <div className="ui-recap-progress-bar" style={{ width: "100%", marginTop: 4 }}>
                <div className="ui-recap-progress-fill" style={{ width: `${overallRate}%`, background: "#0284c7" }} />
              </div>
            </div>
          </article>
        </section>

        {/* Form Filter Rentang Tanggal */}
        <section className="member-list-card" style={{ marginBottom: 24, padding: "16px 20px" }}>
          <form className="manual-toolbar" method="get" action="/dashboard/recap" style={{ margin: 0, gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="report-field" style={{ margin: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: "#475569" }}>Dari tanggal (WIB)</span>
              <input type="date" name="from" defaultValue={range.from} className="cycle-field-input" style={{ marginTop: 4 }} />
            </label>
            <label className="report-field" style={{ margin: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: "#475569" }}>Sampai tanggal (WIB)</span>
              <input type="date" name="to" defaultValue={range.to} className="cycle-field-input" style={{ marginTop: 4 }} />
            </label>
            <button type="submit" className="duty-btn-add" style={{ height: 40, borderRadius: 8, padding: "0 20px" }}>
              Tampilkan Data
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Link
                href={`/dashboard/recap?from=${todayWib}&to=${todayWib}`}
                className="ui-pill-btn"
                style={{ fontSize: 11.5 }}
              >
                Hari Ini
              </Link>
              <Link
                href="/dashboard/recap"
                className="ui-pill-btn"
                style={{ fontSize: 11.5 }}
              >
                7 Hari Terakhir
              </Link>
            </div>
          </form>
        </section>

        {range.error ? (
          <p className="manual-note" role="status" style={{ marginBottom: 20 }}>{range.error}</p>
        ) : null}

        {orderedDays.length === 0 ? (
          <div className="ui-empty-card">
            <div className="ui-empty-icon" aria-hidden="true">📅</div>
            <h3 className="ui-empty-title">Belum ada data pada rentang ini</h3>
            <p className="ui-empty-desc">
              Silakan sesuaikan tanggal mulai dan akhir pada filter di atas, atau tunggu presensi RFID masuk.
            </p>
          </div>
        ) : (
          <>
            {/* TABEL RINGKASAN REKAP HARIAN (MASTER TABLE) */}
            <section className="member-list-card" style={{ marginBottom: 32, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    📊 Ringkasan Kehadiran per Hari
                  </h2>
                  <p style={{ fontSize: 12.5, color: "#64748b", margin: "4px 0 0" }}>
                    Ikhtisar kehadiran seluruh sesi piket untuk setiap tanggal.
                  </p>
                </div>
                <span className="ui-pill-btn" style={{ fontSize: 11.5 }}>
                  {orderedDays.length} Tanggal
                </span>
              </div>

              <div className="member-table-wrap">
                <table className="member-table table-stack">
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Kegiatan</th>
                      <th scope="col" style={{ textAlign: "center" }}>Hadir</th>
                      <th scope="col" style={{ textAlign: "center" }}>Belum</th>
                      <th scope="col" style={{ minWidth: 140 }}>Persentase</th>
                      <th scope="col">Status</th>
                      <th scope="col" style={{ textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedDays.map((day) => {
                      const label = dayHeading.format(parseDateOnlyToUtc(day.date));
                      const shortLabel = shortDateHeading.format(parseDateOnlyToUtc(day.date));
                      const dayTotal = day.recordedCount + day.absentCount;
                      const dayPct = dayTotal > 0 ? Math.round((day.recordedCount / dayTotal) * 100) : 0;
                      const activeActivities = day.activities.map((a) => a.activityName);

                      return (
                        <tr key={`summary-${day.date}`}>
                          <td data-label="Tanggal">
                            <div>
                              <strong style={{ color: "#0f172a", fontSize: 13.5 }}>{shortLabel}</strong>
                              <span style={{ display: "block", fontSize: 11.5, color: "#64748b" }}>
                                {day.date}
                              </span>
                            </div>
                          </td>
                          <td data-label="Kegiatan">
                            {day.holidayReason ? (
                              <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                                Libur: {day.holidayReason}
                              </span>
                            ) : activeActivities.length > 0 ? (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {activeActivities.map((act) => (
                                  <span
                                    key={act}
                                    className="ui-pill-btn"
                                    style={{ fontSize: 11, padding: "2px 8px", background: "#f8fafc" }}
                                  >
                                    {act}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>Tidak ada sesi</span>
                            )}
                          </td>
                          <td data-label="Hadir" style={{ textAlign: "center" }}>
                            <span className="ui-status-badge hadir" style={{ display: "inline-flex" }}>
                              <span className="ui-status-dot" aria-hidden="true" />
                              {day.recordedCount}
                            </span>
                          </td>
                          <td data-label="Belum" style={{ textAlign: "center" }}>
                            {day.absentCount > 0 ? (
                              <span className="ui-status-badge terlambat" style={{ display: "inline-flex" }}>
                                <span className="ui-status-dot" aria-hidden="true" />
                                {day.absentCount}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>0</span>
                            )}
                          </td>
                          <td data-label="Persentase">
                            {dayTotal > 0 ? (
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 650, marginBottom: 4 }}>
                                  <span style={{ color: dayPct >= 80 ? "#16a34a" : dayPct >= 50 ? "#d97706" : "#dc2626" }}>
                                    {dayPct}%
                                  </span>
                                  <span style={{ color: "#64748b", fontWeight: 400 }}>{day.recordedCount}/{dayTotal}</span>
                                </div>
                                <div className="ui-recap-progress-bar" style={{ width: "100%" }}>
                                  <div
                                    className="ui-recap-progress-fill"
                                    style={{
                                      width: `${dayPct}%`,
                                      background: dayPct >= 80 ? "#16a34a" : dayPct >= 50 ? "#d97706" : "#dc2626",
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td data-label="Status">
                            {day.holidayReason ? (
                              <span className="ui-status-badge belum" style={{ background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>
                                Libur
                              </span>
                            ) : (
                              <span className="ui-status-badge hadir" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>
                                Normal
                              </span>
                            )}
                          </td>
                          <td data-label="Aksi" style={{ textAlign: "center" }}>
                            <a
                              href={`#detail-${day.date}`}
                              className="ui-pill-btn"
                              style={{ fontSize: 11, padding: "4px 10px", textDecoration: "none", color: "#18735a", fontWeight: 600 }}
                            >
                              Rincian &darr;
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION RINCIAN PER TANGGAL (SIMPLE CARDS & TABLES) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  📋 Rincian Presensi Siswa per Hari
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Daftar nama petugas hadir dan belum absen per tanggal
                </span>
              </div>

              {orderedDays.map((day) => {
                const label = dayHeading.format(parseDateOnlyToUtc(day.date));
                const hasActivities = day.activities.length > 0;
                const totalDayAbsent = day.absentCount;

                // Flatten all recorded entries with activity name for simple single table per day
                const allRecorded = day.activities.flatMap((act) =>
                  act.recorded.map((rec) => ({
                    ...rec,
                    activityName: act.activityName,
                    activityId: act.activityId,
                  }))
                );

                // Gather all absent members
                const allAbsent = day.activities.flatMap((act) =>
                  act.absent.map((ab) => ({
                    ...ab,
                    activityName: act.activityName,
                  }))
                );

                // Gather all non-petugas scans
                const allOutside = day.activities.flatMap((act) =>
                  act.outside.map((out) => ({
                    ...out,
                    activityName: act.activityName,
                  }))
                );

                return (
                  <article
                    id={`detail-${day.date}`}
                    key={`card-${day.date}`}
                    className="member-list-card"
                    style={{ padding: "20px 24px", scrollMarginTop: 80 }}
                  >
                    {/* Header Hari */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 14, marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>📅</span>
                        <div>
                          <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                            {label}
                          </h3>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {day.date} {day.holidayReason ? `&bull; Libur: ${day.holidayReason}` : ""}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="ui-status-badge hadir">
                          <span className="ui-status-dot" aria-hidden="true" />
                          {day.recordedCount} Hadir
                        </span>

                        {totalDayAbsent > 0 && (
                          <span className="ui-status-badge terlambat">
                            <span className="ui-status-dot" aria-hidden="true" />
                            {totalDayAbsent} Belum Absen
                          </span>
                        )}

                        {day.holidayReason && (
                          <span className="ui-status-badge belum" style={{ background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>
                            Libur
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Holiday note */}
                    {day.holidayReason && (
                      <div className="manual-note" role="status" style={{ marginBottom: 14 }}>
                        <strong>Keterangan Hari Libur:</strong> {day.holidayReason}
                      </div>
                    )}

                    {!hasActivities && !day.holidayReason && (
                      <p style={{ fontSize: 13, color: "#64748b", margin: "10px 0" }}>
                        Tidak ada sesi absensi atau jadwal piket aktif pada tanggal ini.
                      </p>
                    )}

                    {/* TABEL ANGGOTA HADIR */}
                    {hasActivities && (
                      <>
                        {allRecorded.length === 0 ? (
                          <div style={{ padding: "16px", borderRadius: 8, background: "#f8fafc", textAlign: "center", color: "#64748b", fontSize: 13, marginBottom: 14 }}>
                            Belum ada presensi siswa yang tercatat pada tanggal ini.
                          </div>
                        ) : (
                          <div className="member-table-wrap" style={{ marginBottom: 14 }}>
                            <table className="member-table table-stack">
                              <thead>
                                <tr>
                                  <th scope="col">Nama Siswa</th>
                                  <th scope="col">Kegiatan</th>
                                  <th scope="col">Kelas</th>
                                  <th scope="col">Status</th>
                                  <th scope="col">Waktu Scan</th>
                                  <th scope="col">Keterangan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allRecorded.map((person) => {
                                  const statusStyle = person.status ? ATTENDANCE_STATUS_STYLE[person.status] ?? "belum" : "belum";
                                  const statusLabel = person.status ? ATTENDANCE_STATUS_LABEL[person.status] ?? person.status : "—";
                                  const initial = person.fullName.charAt(0).toUpperCase();

                                  return (
                                    <tr key={`rec-${person.activityId}-${person.memberId}`}>
                                      <td data-label="Nama">
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <span className="ui-avatar" style={{ width: 28, height: 28, fontSize: 11 }} aria-hidden="true">
                                            {initial}
                                          </span>
                                          <div>
                                            <strong style={{ color: "#0f172a" }}>{person.fullName}</strong>
                                            {person.isSubstitution && (
                                              <span style={{ display: "block", fontSize: 10.5, color: "#0284c7" }}>
                                                Pengganti {person.replaces}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td data-label="Kegiatan">
                                        <span className="ui-pill-btn" style={{ fontSize: 11, background: "#f1f5f9" }}>
                                          {person.activityName}
                                        </span>
                                      </td>
                                      <td data-label="Kelas">{person.classGrade ?? "—"}</td>
                                      <td data-label="Status">
                                        <span className={`ui-status-badge ${statusStyle}`}>
                                          <span className="ui-status-dot" aria-hidden="true" />
                                          {statusLabel}
                                        </span>
                                      </td>
                                      <td data-label="Waktu" className="manual-time">
                                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                                          {person.timeWib ?? "—"}
                                        </span>
                                      </td>
                                      <td data-label="Catatan">{person.notes ?? "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* LIST BELUM ABSEN (CLEAN BADGES) */}
                        {allAbsent.length > 0 && (
                          <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fef3c7" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 750, color: "#92400e" }}>
                                ⚠️ Belum Absen ({allAbsent.length} siswa):
                              </span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {allAbsent.map((person) => (
                                <span
                                  key={`abs-${person.activityName}-${person.memberId}`}
                                  className="ui-pill-btn"
                                  style={{ background: "#ffffff", borderColor: "#fde68a", fontSize: 11.5, color: "#78350f" }}
                                >
                                  <strong>{person.fullName}</strong>
                                  {person.classGrade ? ` (${person.classGrade})` : ""}
                                  <span style={{ color: "#b45309", marginLeft: 4 }}>&bull; {person.activityName}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* LIST SCAN NON-PETUGAS */}
                        {allOutside.length > 0 && (
                          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 8, background: "#f0f9ff", border: "1px solid #e0f2fe" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 750, color: "#0369a1" }}>
                                ℹ️ Scan di Luar Jadwal Piket ({allOutside.length} siswa):
                              </span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {allOutside.map((person) => (
                                <span
                                  key={`out-${person.activityName}-${person.memberId}`}
                                  className="ui-pill-btn"
                                  style={{ background: "#ffffff", borderColor: "#bae6fd", fontSize: 11.5, color: "#0c4a6e" }}
                                >
                                  <strong>{person.fullName}</strong>
                                  <span style={{ marginLeft: 4, color: "#0284c7" }}>
                                    &bull; {person.activityName} ({person.status ? ATTENDANCE_STATUS_LABEL[person.status] ?? person.status : "—"})
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
