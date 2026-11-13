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
        </div>
        <p className="settings-page-desc">
          Lihat siapa yang sudah tercatat dan siapa yang belum absen pada setiap tanggal,
          dipisahkan per kegiatan piket. Klik tanggal untuk membuka rinciannya.
        </p>
      </header>

      <div className="settings-page-body recap-body">
        <form className="manual-toolbar" method="get" action="/dashboard/recap">
          <label className="report-field">
            <span>Dari tanggal</span>
            <input type="date" name="from" defaultValue={range.from} />
          </label>
          <label className="report-field">
            <span>Sampai tanggal</span>
            <input type="date" name="to" defaultValue={range.to} />
          </label>
          <button type="submit" className="report-btn report-btn--primary">Tampilkan</button>
          <div className="manual-summary">
            <span><strong>{days.length}</strong> hari</span>
            <span><strong>{totalRecorded}</strong> tercatat</span>
            <span><strong>{totalAbsent}</strong> belum absen</span>
          </div>
        </form>

        {range.error ? (
          <p className="manual-note" role="status">{range.error}</p>
        ) : null}

        {orderedDays.length === 0 ? (
          <div className="manual-empty">
            <strong>Belum ada data pada rentang ini</strong>
            <span>Ubah rentang tanggal atau tunggu scan RFID masuk.</span>
          </div>
        ) : (
          <div className="recap-days">
            {orderedDays.map((day, index) => {
              const label = dayHeading.format(parseDateOnlyToUtc(day.date));
              const hasContent = day.activities.length > 0 || day.cancelledActivities.length > 0;
              return (
                <details className="recap-day" key={day.date} open={index === 0}>
                  <summary className="recap-day-summary">
                    <span className="recap-day-date">{label}</span>
                    <span className="recap-day-counts">
                      <span className="recap-count is-ok">{day.recordedCount} tercatat</span>
                      <span className="recap-count is-warn">{day.absentCount} belum</span>
                      {day.holidayReason ? (
                        <span className="recap-count is-holiday">Libur</span>
                      ) : null}
                    </span>
                  </summary>

                  <div className="recap-day-body">
                    {day.holidayReason ? (
                      <p className="manual-note" role="status">
                        <strong>Libur:</strong> {day.holidayReason}
                      </p>
                    ) : null}

                    {!hasContent ? (
                      <p className="recap-empty">
                        Tidak ada jadwal piket maupun sesi absensi pada tanggal ini.
                      </p>
                    ) : null}

                    {day.cancelledActivities.length > 0 && !day.holidayReason ? (
                      <p className="recap-empty">
                        Diliburkan: {day.cancelledActivities.join(", ")}
                      </p>
                    ) : null}

                    {day.activities.map((activity) => (
                      <section className="recap-activity" key={activity.activityId}>
                        <header className="recap-activity-head">
                          <h3>{activity.activityName}</h3>
                          <p>
                            {activity.hasDutySchedule
                              ? `${activity.weekLabel} · ${activity.startTime}–${activity.cutoffTime} WIB`
                              : "Sesi tanpa jadwal piket"}
                          </p>
                          <span className="recap-activity-count">
                            {activity.recorded.length} tercatat · {activity.absent.length} belum
                          </span>
                        </header>

                        {activity.recorded.length === 0 ? (
                          <p className="recap-empty-small">Belum ada yang tercatat.</p>
                        ) : (
                          <div className="member-table-wrap">
                            <table className="member-table table-stack">
                              <thead>
                                <tr>
                                  <th scope="col">Nama</th>
                                  <th scope="col">Kelas</th>
                                  <th scope="col">Status</th>
                                  <th scope="col">Waktu</th>
                                  <th scope="col">Catatan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activity.recorded.map((person) => (
                                  <tr key={`${activity.activityId}-${person.memberId}`}>
                                    <td data-label="Nama">
                                      {person.fullName}
                                      {person.isSubstitution ? (
                                        <small>Pengganti {person.replaces}</small>
                                      ) : null}
                                    </td>
                                    <td data-label="Kelas">{person.classGrade ?? "—"}</td>
                                    <td data-label="Status">
                                      <span
                                        className={`dh-status is-${
                                          person.status
                                            ? ATTENDANCE_STATUS_STYLE[person.status] ?? "belum"
                                            : "belum"
                                        }`}
                                      >
                                        {person.status
                                          ? ATTENDANCE_STATUS_LABEL[person.status] ?? person.status
                                          : "—"}
                                      </span>
                                    </td>
                                    <td data-label="Waktu" className="manual-time">
                                      {person.timeWib ?? "—"}
                                    </td>
                                    <td data-label="Catatan">{person.notes ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {activity.absent.length > 0 ? (
                          <div className="recap-absent">
                            <h4>Belum absen ({activity.absent.length})</h4>
                            <ul>
                              {activity.absent.map((person) => (
                                <li key={`${activity.activityId}-absent-${person.memberId}`}>
                                  {person.fullName}
                                  <span>{person.classGrade ?? "—"}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {activity.outside.length > 0 ? (
                          <div className="recap-absent">
                            <h4>Scan non-petugas ({activity.outside.length})</h4>
                            <ul>
                              {activity.outside.map((person) => (
                                <li key={`${activity.activityId}-outside-${person.memberId}`}>
                                  {person.fullName}
                                  <span>
                                    {person.classGrade ?? "—"} ·{" "}
                                    {person.status
                                      ? ATTENDANCE_STATUS_LABEL[person.status] ?? person.status
                                      : "—"}
                                  </span>
                                </li>
                              ))}
                            </ul>
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
