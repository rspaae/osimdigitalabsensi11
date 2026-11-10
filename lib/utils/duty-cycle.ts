import { CycleWeek, DayOfWeek } from "@prisma/client";
import { parseDateOnlyToUtc } from "./timezone";
import { BusinessRuleError } from "@/lib/services/errors";

const WIB_OFFSET_HOURS = 7;
const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export interface WibDateComponents {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  timeWithSecondsStr: string; // HH:mm:ss
  dayOfWeek: DayOfWeek;
  wibDate: Date;
}

/**
 * Mendapatkan komponen tanggal, jam, dan hari dalam zona waktu WIB (UTC+7).
 */
export function getWibDateComponents(date: Date = new Date()): WibDateComponents {
  const wibTimeMs = date.getTime() + WIB_OFFSET_MS;
  const wibDate = new Date(wibTimeMs);

  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibDate.getUTCDate()).padStart(2, "0");
  const hours = String(wibDate.getUTCHours()).padStart(2, "0");
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(wibDate.getUTCSeconds()).padStart(2, "0");

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;
  const timeWithSecondsStr = `${hours}:${minutes}:${seconds}`;
  const dayOfWeek = DAY_OF_WEEK_MAP[wibDate.getUTCDay()];

  return {
    dateStr,
    timeStr,
    timeWithSecondsStr,
    dayOfWeek,
    wibDate,
  };
}

/**
 * Menghitung posisi minggu siklus (WEEK_1 atau WEEK_2) berdasarkan tanggal mulai siklus.
 * Siklus berjalan 14 hari:
 * - Hari 0..6  (7 hari pertama)  -> WEEK_1
 * - Hari 7..13 (7 hari berikutnya) -> WEEK_2
 * - Hari 14 kembali berulang ke WEEK_1.
 *
 * Akurat melintasi pergantian bulan dan tahun karena berbasis UTC timestamp integer arithmetic.
 */
export function calculateCycleWeek(
  date: Date,
  cycleStartDateStr: string
): {
  cycleWeek: CycleWeek;
  dayOfWeek: DayOfWeek;
  diffDays: number;
  cycleDay: number;
} {
  const { dateStr, dayOfWeek } = getWibDateComponents(date);

  const cycleStartUtc = parseDateOnlyToUtc(cycleStartDateStr);
  const currentUtc = parseDateOnlyToUtc(dateStr);

  const diffMs = currentUtc.getTime() - cycleStartUtc.getTime();
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffDays < 0) {
    throw new BusinessRuleError(
      `Tanggal transaksi (${dateStr}) berada sebelum tanggal mulai siklus (${cycleStartDateStr}).`,
      "CYCLE_DATE_BEFORE_START"
    );
  }

  const cycleDay = diffDays % 14;
  const cycleWeek = cycleDay < 7 ? CycleWeek.WEEK_1 : CycleWeek.WEEK_2;

  return {
    cycleWeek,
    dayOfWeek,
    diffDays,
    cycleDay,
  };
}
