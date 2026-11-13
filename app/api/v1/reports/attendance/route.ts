import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { reportQuerySchema, REPORT_STATUS_COLUMNS } from "@/lib/validators/report.schema";
import {
  getAttendanceReport,
  ORGANIZATION_LABEL,
  STATUS_LABEL,
} from "@/lib/services/report.service";
import { handleApiError } from "@/lib/services/api-handler";
import { buildReportFileName, toCsv } from "@/lib/utils/report-format";

/**
 * Ekspor CSV rekap kehadiran sesuai filter halaman laporan.
 * Dipisahkan dari halaman agar file yang diunduh identik dengan tabel yang dicetak.
 */
export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.REPORTS, PermissionAction.EXPORT);

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

    const body = report.rows.map((row, index) => [
      index + 1,
      row.name,
      row.nis ?? "",
      row.classGrade ?? "",
      row.position,
      ORGANIZATION_LABEL[row.organization] ?? row.organization,
      ...REPORT_STATUS_COLUMNS.map((status) => row.counts[status]),
      row.unrecorded,
      report.sessions,
      row.rate === null ? "" : `${row.rate}%`,
    ]);

    const csv = toCsv([header, ...body]);

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildReportFileName(report.from, report.to)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
