/** Fungsi murni untuk pengecualian jadwal (libur). */

export interface ScheduleExceptionLike {
  activity_id: string | null;
  reason: string;
}

/** Pengecualian dengan activity_id NULL berlaku untuk semua kegiatan. */
export function isScheduleCancelled(
  exceptions: ScheduleExceptionLike[],
  activityId: string
): boolean {
  return exceptions.some(
    (exception) => exception.activity_id === null || exception.activity_id === activityId
  );
}

/** Alasan pembatalan yang berlaku untuk kegiatan tertentu (null bila tidak libur). */
export function getCancellationReason(
  exceptions: ScheduleExceptionLike[],
  activityId: string
): string | null {
  const exception = exceptions.find(
    (item) => item.activity_id === null || item.activity_id === activityId
  );
  return exception ? exception.reason : null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

/** Memperluas rentang tanggal inklusif menjadi daftar YYYY-MM-DD. */
export function expandDateRange(start: string, end: string): string[] {
  const startUtc = Date.parse(`${start}T00:00:00Z`);
  const endUtc = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startUtc) || Number.isNaN(endUtc)) {
    throw new Error("Tanggal tidak valid.");
  }
  if (endUtc < startUtc) {
    throw new Error("Tanggal akhir tidak boleh sebelum tanggal awal.");
  }

  const totalDays = Math.floor((endUtc - startUtc) / MS_PER_DAY) + 1;
  if (totalDays > MAX_RANGE_DAYS) {
    throw new Error(`Rentang maksimal ${MAX_RANGE_DAYS} hari.`);
  }

  const dates: string[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    dates.push(new Date(startUtc + offset * MS_PER_DAY).toISOString().slice(0, 10));
  }
  return dates;
}
