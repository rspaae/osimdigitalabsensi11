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
          <h1 className="settings-page-title">Rekap Harian per Tanggal</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/dashboard/attendance" className="overview-secondary-action">
              &larr; Log Presensi Realtime
            </Link>
          </div>
        </div>
        <p className="settings-page-desc">
          Evaluasi kehadiran piket siswa per kegiatan pada setiap tanggal. Buka panel tanggal untuk melihat rincian anggota yang hadir tepat waktu, terlambat, maupun yang belum absen.
        </p>
      </header>

      <div className="settings-page-body recap-body">
        {/* Metric Cards Ringkasan Rekap */}
        <section className="ui-stats-grid" aria-label="Statistik Periode">
          <article className="ui-stat-card accent-indigo">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Rentang Waktu</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">📅</span>
            </div>
            <div className="ui-stat-value">{days.length} <span style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>hari</span></div>
            <div className="ui-stat-desc">{range.from} s/d {range.to}</div>
          </article>

          <article className="ui-stat-card accent-mint">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Total Tercatat</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">✓</span>
            </div>
            <div className="ui-stat-value" style={{ color: "#059669" }}>{totalRecorded}</div>
            <div className="ui-stat-desc">Siswa hadir piket atau tap RFID</div>
          </article>

          <article className="ui-stat-card accent-amber">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Belum Absen</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">⚠️</span>
            </div>
            <div className="ui-stat-value" style={{ color: "#d97706" }}>{totalAbsent}</div>
            <div className="ui-stat-desc">Petugas terdaftar yang belum scan</div>
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

        {/* Form Filter Rentang Tanggal Polished */}
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
          <div className="recap-days">
            {orderedDays.map((day, index) => {
              const label = dayHeading.format(parseDateOnlyToUtc(day.date));
              const hasContent = day.activities.length > 0 || day.cancelledActivities.length > 0;
              const dayTotal = day.recordedCount + day.absentCount;
              const dayPct = dayTotal > 0 ? Math.round((day.recordedCount / dayTotal) * 100) : 0;

              return (
                <details className="ui-recap-day" key={day.date} open={index === 0}>
                  <summary className="ui-recap-summary">
                    <span className="ui-recap-day-date">
                      <span style={{ color: "#18735a", fontSize: 16 }}>📅</span>
                      <span>{label}</span>
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      {dayTotal > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 650, color: "#64748b" }}>{dayPct}%</span>
                          <span className="ui-recap-progress-bar">
                            <span className="ui-recap-progress-fill" style={{ width: `${dayPct}%` }} />
                          </span>
                        </div>
                      )}

                      <span className="ui-status-badge hadir">
                        <span className="ui-status-dot" aria-hidden="true" />
                        {day.recordedCount} tercatat
                      </span>

                      {day.absentCount > 0 && (
                        <span className="ui-status-badge terlambat">
                          <span className="ui-status-dot" aria-hidden="true" />
                          {day.absentCount} belum
                        </span>
                      )}

                      {day.holidayReason ? (
                        <span className="ui-status-badge belum" style={{ background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>
                          Libur
                        </span>
                      ) : null}
                    </div>
                  </summary>

                  <div className="recap-day-body" style={{ padding: "16px 20px" }}>
                    {day.holidayReason ? (
                      <p className="manual-note" role="status" style={{ marginBottom: 14 }}>
                        <strong>Keterangan Libur:</strong> {day.holidayReason}
                      </p>
                    ) : null}

                    {!hasContent ? (
                      <p className="recap-empty" style={{ margin: "10px 0" }}>
                        Tidak ada jadwal piket maupun sesi absensi pada tanggal ini.
                      </p>
                    ) : null}

                    {day.cancelledActivities.length > 0 && !day.holidayReason ? (
                      <p className="recap-empty" style={{ margin: "10px 0" }}>
                        Diliburkan: {day.cancelledActivities.join(", ")}
                      </p>
                    ) : null}

                    {day.activities.map((activity) => (
                      <section className="recap-activity" key={activity.activityId} style={{ marginBottom: 20 }}>
                        <header className="recap-activity-head" style={{ marginBottom: 12 }}>
                          <div>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>
                              {activity.activityName}
                            </h3>
                            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                              {activity.hasDutySchedule
                                ? `${activity.weekLabel} · ${activity.startTime}–${activity.cutoffTime} WIB`
                                : "Sesi tanpa jadwal piket"}
                            </p>
                          </div>
                          <span className="ui-pill-btn" style={{ fontSize: 11 }}>
                            <strong>{activity.recorded.length}</strong> hadir &bull; <strong>{activity.absent.length}</strong> belum
                          </span>
                        </header>

                        {activity.recorded.length === 0 ? (
                          <div className="ui-empty-card" style={{ padding: "20px 14px", margin: "10px 0" }}>
                            <p className="ui-empty-desc" style={{ fontSize: 12 }}>Belum ada anggota yang tercatat pada kegiatan ini.</p>
                          </div>
                        ) : (
                          <div className="member-table-wrap">
                            <table className="member-table table-stack">
                              <thead>
                                <tr>
                                  <th scope="col">Nama Anggota</th>
                                  <th scope="col">Kelas</th>
                                  <th scope="col">Status Kehadiran</th>
                                  <th scope="col">Waktu Scan</th>
                                  <th scope="col">Catatan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activity.recorded.map((person) => {
                                  const statusStyle = person.status ? ATTENDANCE_STATUS_STYLE[person.status] ?? "belum" : "belum";
                                  const statusLabel = person.status ? ATTENDANCE_STATUS_LABEL[person.status] ?? person.status : "—";
                                  const initial = person.fullName.charAt(0).toUpperCase();

                                  return (
                                    <tr key={`${activity.activityId}-${person.memberId}`}>
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

                        {activity.absent.length > 0 ? (
                          <div className="recap-absent" style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fef3c7" }}>
                            <h4 style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e", margin: "0 0 8px" }}>
                              Belum Absen ({activity.absent.length} orang)
                            </h4>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {activity.absent.map((person) => (
                                <span
                                  key={`${activity.activityId}-absent-${person.memberId}`}
                                  className="ui-pill-btn"
                                  style={{ background: "#ffffff", borderColor: "#fde68a", fontSize: 11.5, color: "#78350f" }}
                                >
                                  {person.fullName} {person.classGrade ? `(${person.classGrade})` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {activity.outside.length > 0 ? (
                          <div className="recap-absent" style={{ marginTop: 10, padding: "12px 16px", borderRadius: 10, background: "#f0f9ff", border: "1px solid #e0f2fe" }}>
                            <h4 style={{ fontSize: 12.5, fontWeight: 700, color: "#0369a1", margin: "0 0 8px" }}>
                              Scan Non-Petugas ({activity.outside.length} orang)
                            </h4>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {activity.outside.map((person) => (
                                <span
                                  key={`${activity.activityId}-outside-${person.memberId}`}
                                  className="ui-pill-btn"
                                  style={{ background: "#ffffff", borderColor: "#bae6fd", fontSize: 11.5, color: "#0c4a6e" }}
                                >
                                  {person.fullName} &bull; {person.status ? ATTENDANCE_STATUS_LABEL[person.status] ?? person.status : "—"}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
