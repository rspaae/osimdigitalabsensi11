/**
 * Mengatur offset minggu siklus per kegiatan.
 *
 * Contoh:
 *   npm run set:week-offset -- --activity DANUSAN --offset 1
 *   npm run set:week-offset -- --list
 *
 * Offset:
 *   0 = mengikuti minggu siklus global (default)
 *   1 = kebalikan minggu global (WEEK_1 <-> WEEK_2)
 *
 * Nilai disimpan di SystemSetting `activity_week_offset:<KODE>` sehingga
 * tidak memerlukan migrasi database.
 */

import { CycleWeek } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import {
  applyCycleWeekOffset,
  getActivityWeekOffsets,
  setActivityWeekOffset,
  weekLabel,
} from "../lib/services/activity-week.service";
import { getCycleStatus } from "../lib/services/duty.service";

const args = process.argv.slice(2);
const getArg = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

async function printList() {
  const [activities, offsets, status] = await Promise.all([
    prisma.activity.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    getActivityWeekOffsets(),
    getCycleStatus(),
  ]);

  const globalWeek =
    status.configured && "cycle_week" in status
      ? (status.cycle_week as CycleWeek | null)
      : null;

  console.log(`Siklus global hari ini: ${globalWeek ? weekLabel(globalWeek) : "belum aktif"}`);
  console.log("");
  for (const activity of activities) {
    const offset = offsets.get(activity.code.toUpperCase()) ?? 0;
    const effective = globalWeek
      ? weekLabel(applyCycleWeekOffset(globalWeek, offset))
      : "-";
    console.log(
      `- ${activity.code.padEnd(12)} ${activity.name.padEnd(18)} offset=${offset}  minggu efektif=${effective}`
    );
  }
}

async function main() {
  const activityCode = getArg("--activity");
  const offsetRaw = getArg("--offset");

  if (args.includes("--list") || !activityCode) {
    await printList();
    await prisma.$disconnect();
    return;
  }

  if (offsetRaw === undefined || !/^-?\d+$/.test(offsetRaw)) {
    console.error("--offset wajib berupa angka (0 atau 1).");
    process.exit(1);
  }

  const activity = await prisma.activity.findUnique({
    where: { code: activityCode.toUpperCase() },
    select: { code: true, name: true },
  });
  if (!activity) {
    console.error(`Kegiatan dengan kode "${activityCode}" tidak ditemukan.`);
    process.exit(1);
  }

  const saved = await setActivityWeekOffset(activity.code, Number(offsetRaw));
  console.log(
    `OK: ${activity.name} (${activity.code}) offset=${saved}. ` +
      (saved === 1
        ? "Kegiatan ini memakai minggu kebalikan dari siklus global."
        : "Kegiatan ini mengikuti minggu siklus global.")
  );
  await printList();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
