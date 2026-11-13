/** Rentang tanggal untuk halaman rekap harian. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function shift(dateStr: string, days: number): string {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export interface RecapRange {
  from: string;
  to: string;
  error: string | null;
}

/**
 * Menormalkan filter tanggal rekap harian.
 * Default: `defaultDays` hari terakhir (termasuk hari ini).
 * Maksimum: `maxDays` hari agar query tetap ringan.
 */
export function resolveRecapRange(params: {
  from?: string;
  to?: string;
  today: string;
  defaultDays?: number;
  maxDays?: number;
}): RecapRange {
  const defaultDays = params.defaultDays ?? 7;
  const maxDays = params.maxDays ?? 62;

  const fallback: RecapRange = {
    from: shift(params.today, -(defaultDays - 1)),
    to: params.today,
    error: null,
  };

  const from = params.from;
  const to = params.to;

  if (!from && !to) return fallback;

  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) {
    return { ...fallback, error: "Format tanggal harus YYYY-MM-DD." };
  }

  const start = from ?? fallback.from;
  const end = to ?? fallback.to;

  if (start > end) {
    return { ...fallback, error: "Tanggal awal tidak boleh melewati tanggal akhir." };
  }

  const totalDays =
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY) + 1;

  if (totalDays > maxDays) {
    return {
      ...fallback,
      error: `Rentang maksimal ${maxDays} hari. Menampilkan ${defaultDays} hari terakhir.`,
    };
  }

  return { from: start, to: end, error: null };
}
