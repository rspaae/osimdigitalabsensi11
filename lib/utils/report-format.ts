/**
 * Utilitas format laporan yang murni (tanpa I/O) agar mudah diuji.
 */

/**
 * Meng-escape satu sel CSV. Pembatas kolom laporan memakai `;` karena Excel
 * dengan locale Indonesia memperlakukan `,` sebagai pemisah desimal.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");
}

/** Nama file aman untuk diunduh (tanpa karakter yang tidak valid di Windows). */
export function buildReportFileName(
  from: string,
  to: string,
  extension: "csv" | "xlsx" = "csv"
): string {
  const safe = (value: string) => value.replace(/[^0-9A-Za-z-]/g, "");
  return `laporan-kehadiran_${safe(from)}_${safe(to)}.${extension}`;
}

/**
 * Persentase kehadiran = (Hadir + Terlambat) / jumlah sesi × 100.
 * Mengembalikan `null` bila periode tidak memiliki sesi (tidak ada pembagi).
 */
export function calculateRate(
  counts: { HADIR: number; TERLAMBAT: number },
  sessions: number
): number | null {
  if (sessions <= 0) return null;
  const present = counts.HADIR + counts.TERLAMBAT;
  return Math.round((present / sessions) * 100);
}
