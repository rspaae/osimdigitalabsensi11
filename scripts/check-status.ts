import { prisma } from "../lib/db/prisma";

async function main() {
  const userCount = await prisma.user.count();
  const memberCount = await prisma.member.count();
  const deviceCount = await prisma.device.count();
  const dutyScheduleCount = await prisma.dutySchedule.count();
  const rosterCount = await prisma.dutyRosterMember.count();
  const cycleSetting = await prisma.systemSetting.findUnique({
    where: { key: "cycle_start_date" },
  });
  const devices = await prisma.device.findMany({
    select: {
      id: true,
      device_code: true,
      name: true,
      is_active: true,
      last_seen: true,
    },
  });
  const members = await prisma.member.findMany({
    select: { id: true, full_name: true, rfid_uid: true, status: true },
    take: 10,
  });

  console.log(
    JSON.stringify(
      {
        userCount,
        memberCount,
        deviceCount,
        dutyScheduleCount,
        rosterCount,
        cycleSetting,
        devices,
        members,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
