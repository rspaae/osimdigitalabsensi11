import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { buildReportFileName } from "@/lib/utils/report-format";
import { buildXlsx, type XlsxCell } from "@/lib/utils/xlsx";
import { reportQuerySchema, REPORT_STATUS_COLUMNS } from "@/lib/validators/report.schema";
import {
  getAttendanceReport,
  ORGANIZATION_LABEL,
  STATUS_LABEL,
} from "@/lib/services/report.service";
import { handleApiError } from "@/lib/services/api-handler";

/**
 * Ekspor XLSX rekap kehadiran. Isi dan urutan kolom sama dengan halaman
 * laporan/cetak, ditambah sheet "Info" berisi parameter filter.
 */
export async function GET(request: Request) {
  try {
    const user = await requirePermission(
      AppModule.REPORTS,
      PermissionAction.EXPORT
    );

    const { searchParams } = new URL(request.url);
    const query = reportQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const report = await getAttendanceReport(query);

    const header = [
      "No",
      "Nama",
      "NIS",
      "Kelas",
      "Jabatan",
      "Organisasi",
      ...REPORT_STATUS_COLUMNS.map((status) => STATUS_LABEL[status]),
      "Belum tercatat",
      "Total sesi",
      "% Kehadiran",
    ];

    const body: XlsxCell[][] = report.rows.map((row, index) => [
      index + 1,
      row.name,
      row.nis ?? "",
      row.classGrade ?? "",
      row.position,
      ORGANIZATION_LABEL[row.organization] ?? row.organization,
      ...REPORT_STATUS_COLUMNS.map((status) => row.counts[status]),
      row.unrecorded,
      report.sessions,
      row.rate === null ? "" : row.rate / 100,
    ]);

    const totalRow: XlsxCell[] = [
      "",
      "Jumlah",
      "",
      "",
      "",
      "",
      ...REPORT_STATUS_COLUMNS.map((status) => report.totals[status]),
      report.totals.unrecorded,
      report.sessions,
      report.averageRate / 100,
    ];

    const percentColumnIndex = header.length - 1;

    const worksheetRows: XlsxCell[][] = [header, ...body, totalRow];

    const now = new Date();
    const { timeWithSecondsStr } = getWibDateComponents(now);

    const infoRows: XlsxCell[][] = [
      ["Laporan Kehadiran Anggota"],
      ["Organisasi", "OSIS MPK SMKN 11 Bandung"],
      ["Periode", `${report.from} s.d. ${report.to}`],
      ["Kegiatan", report.activityName ?? "Semua kegiatan"],
      [
        "Filter organisasi",
        report.organization ? ORGANIZATION_LABEL[report.organization] : "Semua organisasi",
      ],
      ["Termasuk anggota nonaktif", report.includeInactive ? "Ya" : "Tidak"],
      ["Jumlah anggota", report.rows.length],
      ["Jumlah sesi absensi", report.sessions],
      ["Rata-rata kehadiran", `${report.averageRate}%`],
      [
        "Rumus kehadiran",
        "Persentase = (Hadir + Terlambat) ÷ jumlah sesi × 100%",
      ],
      [
        "Catatan",
        "Sesi DRAFT tidak dihitung. Status ALPA hanya terisi bila rekonsiliasi sesi CLOSED dijalankan.",
      ],
      ["Dicetak", `${report.to} ${timeWithSecondsStr} WIB oleh ${user.username}`],
    ];

    const buffer = buildXlsx([
      {
        name: "Kehadiran",
        rows: worksheetRows,
        headerRows: 1,
        percentColumns: [percentColumnIndex],
        totalRowIndex: worksheetRows.length - 1,
        columnWidths: [5, 32, 13, 13, 26, 12, 8, 11, 7, 7, 7, 11, 11, 9, 12],
      },
      {
        name: "Info",
        rows: infoRows,
        headerRows: 0,
        columnWidths: [26, 78],
      },
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${buildReportFileName(report.from, report.to, "xlsx")}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
