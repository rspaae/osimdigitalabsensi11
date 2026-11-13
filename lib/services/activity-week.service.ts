import { CycleWeek } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Offset minggu siklus per kegiatan.
 *
 * Sebagian kegiatan (mis. Danusan) memakai rotasi minggu yang berbeda dari
 * siklus global. Offset disimpan di `SystemSetting` dengan key
 * `activity_week_offset:<KODE_KEGIATAN>` dan nilai "0" atau "1":
 * - "0" → mengikuti minggu siklus global (default)
 * - "1" → kebalikan minggu global (WEEK_1 ↔ WEEK_2)
 *
 * Nilai selain 0/1 dinormalisasi modulo 2 agar rotasi tetap konsisten.
 */
export const ACTIVITY_WEEK_OFFSET_PREFIX = "activity_week_offset:";

export function flipCycleWeek(week: CycleWeek): CycleWeek {
  return week === CycleWeek.WEEK_1 ? CycleWeek.WEEK_2 : CycleWeek.WEEK_1;
}

export function applyCycleWeekOffset(week: CycleWeek, offset: number): CycleWeek {
  const normalized = ((Math.trunc(offset) % 2) + 2) % 2;
  return normalized === 1 ? flipCycleWeek(week) : week;
}

export function normalizeWeekOffset(offset: number): 0 | 1 {
  return (((Math.trunc(offset) % 2) + 2) % 2) as 0 | 1;
}

export function weekLabel(week: CycleWeek): string {
  return week === CycleWeek.WEEK_1 ? "Minggu 1" : "Minggu 2";
}

/** Membaca seluruh offset kegiatan sebagai Map<kodeKegiatan, 0|1>. */
export async function getActivityWeekOffsets(): Promise<Map<string, 0 | 1>> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: ACTIVITY_WEEK_OFFSET_PREFIX } },
    select: { key: true, value: true },
  });

  const offsets = new Map<string, 0 | 1>();
  for (const setting of settings) {
    const code = setting.key.slice(ACTIVITY_WEEK_OFFSET_PREFIX.length).trim().toUpperCase();
    if (!code) continue;
    const parsed = Number.parseInt(setting.value, 10);
    const normalized = normalizeWeekOffset(Number.isFinite(parsed) ? parsed : 0);
    if (normalized === 1) offsets.set(code, 1);
  }
  return offsets;
}

/** Minggu efektif untuk satu kegiatan berdasarkan minggu global. */
export async function getEffectiveCycleWeek(
  activityCode: string,
  globalWeek: CycleWeek,
  offsets?: Map<string, 0 | 1>
): Promise<CycleWeek> {
  const map = offsets ?? (await getActivityWeekOffsets());
  return applyCycleWeekOffset(globalWeek, map.get(activityCode.toUpperCase()) ?? 0);
}

/** Menyimpan offset kegiatan; nilai 0 tetap disimpan eksplisit agar mudah diaudit. */
export async function setActivityWeekOffset(
  activityCode: string,
  offset: number
): Promise<0 | 1> {
  const code = activityCode.trim().toUpperCase();
  if (!code) throw new Error("Kode kegiatan wajib diisi.");

  const normalized = normalizeWeekOffset(offset);
  const key = `${ACTIVITY_WEEK_OFFSET_PREFIX}${code}`;

  await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: String(normalized),
      description: `Offset minggu siklus untuk kegiatan ${code} (0 = ikut global, 1 = kebalikan).`,
    },
    update: { value: String(normalized) },
  });

  return normalized;
}
