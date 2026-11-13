import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { AppModule, PermissionAction } from "@/types/auth";
import { prisma } from "@/lib/db/prisma";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import { reportQuerySchema, REPORT_STATUS_COLUMNS, type ReportQuery } from "@/lib/validators/report.schema";
import {
  getAttendanceReport,
  ORGANIZATION_LABEL,
  STATUS_LABEL,
} from "@/lib/services/report.service";
import PrintButton from "./PrintButton";

export const instant = false;

export const metadata: Metadata = {
  title: "Laporan Kehadiran | OSIS MPK SMKN 11 BANDUNG",
};

const numberFormat = new Intl.NumberFormat("id-ID");

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timestampFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function monthRange(dateStr: string): { from: string; to: string } {
  const month = dateStr.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!canAccessModule(user, AppModule.REPORTS, PermissionAction.READ)) {
    redirect("/dashboard");
  }

  const now = new Date();
  const { dateStr: todayWib } = getWibDateComponents(now);
  const defaultRange = monthRange(todayWib);

  const rawParams = await searchParams;
  const flatParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") flatParams[key] = value;
  }

  const parsed = reportQuerySchema.safeParse(flatParams);
  const parsedQuery: ReportQuery = parsed.success
    ? parsed.data
    : { include_inactive: false };
  const filterError = parsed.success ? null : parsed.error.errors[0]?.message ?? "Filter tidak valid.";

  const query: ReportQuery = {
    ...parsedQuery,
    from: parsedQuery.from ?? defaultRange.from,
    to: parsedQuery.to ?? defaultRange.to,
  };

  const [report, activities] = await Promise.all([
    getAttendanceReport(query),
    prisma.activity.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const csvParams = new URLSearchParams({
    from: report.from,
    to: report.to,
    include_inactive: report.includeInactive ? "1" : "0",
  });
  if (query.activity_id) csvParams.set("activity_id", query.activity_id);
  if (query.organization) csvParams.set("organization", query.organization);
  const csvHref = `/api/v1/reports/attendance?${csvParams.toString()}`;
  const xlsxHref = `/api/v1/reports/attendance/xlsx?${csvParams.toString()}`;

  const periodLabel = `${dateFormatter.format(parseDateOnlyToUtc(report.from))} – ${dateFormatter.format(parseDateOnlyToUtc(report.to))}`;
  const activityLabel = report.activityName ?? "Semua kegiatan";
  const organizationLabel = report.organization
    ? ORGANIZATION_LABEL[report.organization]
    : "Semua organisasi";

  return (
    <main className="report-page">
      <header className="settings-page-header report-intro">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Laporan kehadiran</span>
        </nav>

        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Laporan Kehadiran</h1>
        </div>
        <p className="settings-page-desc">
          Rekap kehadiran anggota per periode dengan kolom nama, kelas, jabatan, dan status
          kehadiran. Siap dicetak pada kertas A4, atau diunduh sebagai CSV untuk diolah lebih lanjut.
        </p>
      </header>

      <form className="report-toolbar" method="get" action="/dashboard/reports">
        <div className="report-filters">
          <label className="report-field">
            <span>Dari tanggal</span>
            <input type="date" name="from" defaultValue={report.from} />
          </label>

          <label className="report-field">
            <span>Sampai tanggal</span>
            <input type="date" name="to" defaultValue={report.to} />
          </label>

          <label className="report-field">
            <span>Kegiatan</span>
            <select name="activity_id" defaultValue={query.activity_id ?? ""}>
              <option value="">Semua kegiatan</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </select>
          </label>

          <label className="report-field">
            <span>Organisasi</span>
            <select name="organization" defaultValue={query.organization ?? ""}>
              <option value="">Semua organisasi</option>
              <option value="OSIS">OSIS</option>
              <option value="MPK">MPK</option>
              <option value="GENERAL">Umum</option>
            </select>
          </label>

          <label className="report-check">
            <input
              type="checkbox"
              name="include_inactive"
              value="1"
              defaultChecked={report.includeInactive}
            />
            <span>Sertakan anggota nonaktif</span>
          </label>
        </div>

        <div className="report-actions">
          <button type="submit" className="report-btn report-btn--primary">Terapkan</button>
          <a className="report-btn" href={xlsxHref} download>Unduh XLSX</a>
          <a className="report-btn" href={csvHref} download>Unduh CSV</a>
          <PrintButton />
        </div>
      </form>

      {filterError && (
        <p className="report-filter-error" role="alert">
          {filterError} Menampilkan periode bawaan ({periodLabel}).
        </p>
      )}

      <section className="report-sheet" aria-labelledby="report-title">
        <header className="report-kop">
          <p className="report-org">OSIS MPK SMKN 11 Bandung</p>
          <h2 className="report-title" id="report-title">Laporan Kehadiran Anggota</h2>
          <div className="report-meta">
            <span>Periode: {periodLabel}</span>
            <span>Kegiatan: {activityLabel}</span>
            <span>Organisasi: {organizationLabel}</span>
          </div>
        </header>

        <div className="report-summary">
          <span><strong>{numberFormat.format(report.rows.length)}</strong> anggota</span>
          <span><strong>{numberFormat.format(report.sessions)}</strong> sesi absensi</span>
          <span><strong>{report.averageRate}%</strong> rata-rata kehadiran</span>
        </div>

        {report.rows.length === 0 ? (
          <p className="report-empty">
            Tidak ada anggota yang cocok dengan filter ini. Ubah organisasi, status keaktifan,
            atau periode laporan.
          </p>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <caption className="report-caption">
                Rekap kehadiran {periodLabel} — {activityLabel}. Tanda “–” berarti tidak ada
                catatan; “Belum” adalah sesi yang belum memiliki rekaman absensi.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="report-col-no">No</th>
                  <th scope="col" className="report-col-name">Nama</th>
                  <th scope="col" className="report-col-class">Kelas</th>
                  <th scope="col" className="report-col-position">Jabatan</th>
                  {REPORT_STATUS_COLUMNS.map((status) => (
                    <th scope="col" key={status} className="report-col-count">
                      {STATUS_LABEL[status]}
                    </th>
                  ))}
                  <th scope="col" className="report-col-count">Belum</th>
                  <th scope="col" className="report-col-rate">%</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={row.memberId}>
                    <td className="report-num">{index + 1}</td>
                    <td className="report-name">{row.name}</td>
                    <td>{row.classGrade ?? "—"}</td>
                    <td>{row.position}</td>
                    {REPORT_STATUS_COLUMNS.map((status) => {
                      const value = row.counts[status];
                      return (
                        <td className="report-num" key={status}>
                          {value === 0 ? <span className="report-zero">–</span> : value}
                        </td>
                      );
                    })}
                    <td className="report-num">
                      {row.unrecorded === 0 ? <span className="report-zero">–</span> : row.unrecorded}
                    </td>
                    <td className="report-num report-rate">
                      {row.rate === null ? "—" : `${row.rate}%`}
                    </td>
                  </tr>
                ))}
                <tr className="report-total-row">
                  <th scope="row" colSpan={4} className="report-total-label">Jumlah</th>
                  {REPORT_STATUS_COLUMNS.map((status) => (
                    <td className="report-num" key={status}>{report.totals[status]}</td>
                  ))}
                  <td className="report-num">{report.totals.unrecorded}</td>
                  <td className="report-num report-rate">{report.averageRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <footer className="report-foot">
          <span>
            Dihitung dari {numberFormat.format(report.sessions)} sesi absensi berstatus
            OPEN/CLOSED. Persentase = (Hadir + Terlambat) ÷ sesi × 100%.
          </span>
          <span>
            Dicetak oleh {user.username} · {timestampFormatter.format(now)} WIB
          </span>
        </footer>
      </section>
    </main>
  );
}
