import { prisma } from "../lib/db/prisma";

async function main() {
  const cycleSetting = await prisma.systemSetting.findUnique({
    where: { key: "cycle_start_date" },
  });

  const schedules = await prisma.dutySchedule.findMany({
    include: {
      activity: true,
      roster_members: {
        include: {
          member: true,
        },
      },
    },
    orderBy: [
      { cycle_week: "asc" },
      { day_of_week: "asc" },
      { start_time_wib: "asc" },
    ],
  });

  console.log("CYCLE_START_DATE:", cycleSetting?.value);
  console.log("TOTAL_SCHEDULES:", schedules.length);

  for (const s of schedules) {
    console.log(
      `[${s.cycle_week}] ${s.day_of_week} | ${s.activity.name} (${s.activity.code}) | ${s.start_time_wib} WIB (Cutoff: ${s.cutoff_time_wib} WIB) | Petugas (${s.roster_members.length}): ${s.roster_members.map((r) => r.member.full_name).join(", ") || "(belum ada)"}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
