import { prisma } from "../lib/db/prisma";
import { CycleWeek, DayOfWeek } from "@prisma/client";

async function main() {
  const danusan = await prisma.activity.findUnique({
    where: { code: "DANUSAN" },
  });

  if (!danusan) {
    console.error("Activity DANUSAN tidak ditemukan.");
    process.exit(1);
  }

  const days: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ];

  const weeks: CycleWeek[] = [CycleWeek.WEEK_1, CycleWeek.WEEK_2];

  let createdCount = 0;
  for (const week of weeks) {
    for (const day of days) {
      const existing = await prisma.dutySchedule.findFirst({
        where: {
          activity_id: danusan.id,
          cycle_week: week,
          day_of_week: day,
        },
      });

      if (!existing) {
        await prisma.dutySchedule.create({
          data: {
            activity_id: danusan.id,
            cycle_week: week,
            day_of_week: day,
            start_time_wib: "05:30",
            cutoff_time_wib: "06:00",
            title: `Danusan ${week === CycleWeek.WEEK_1 ? "Minggu 1" : "Minggu 2"} - ${day}`,
            is_active: true,
          },
        });
        createdCount++;
      }
    }
  }

  console.log(`Berhasil membuat ${createdCount} jadwal piket Danusan.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
