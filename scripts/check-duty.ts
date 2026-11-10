import { prisma } from "../lib/db/prisma";

async function run() {
  const activities = await prisma.activity.findMany();
  console.log("ACTIVITIES:", activities);

  const schedules = await prisma.dutySchedule.findMany({
    include: {
      activity: true,
      _count: { select: { roster_members: true } },
    },
  });
  console.log(
    "DUTY SCHEDULES:",
    schedules.map((s) => ({
      id: s.id,
      activity: s.activity.name,
      code: s.activity.code,
      week: s.cycle_week,
      day: s.day_of_week,
      time: `${s.start_time_wib} - ${s.cutoff_time_wib}`,
      roster_count: s._count.roster_members,
    }))
  );

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
