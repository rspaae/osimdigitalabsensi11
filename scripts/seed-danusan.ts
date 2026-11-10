import { prisma } from "../lib/db/prisma";

async function main() {
  const danusan = await prisma.activity.upsert({
    where: { code: "DANUSAN" },
    create: {
      code: "DANUSAN",
      name: "Danusan",
      type: "ROUTINE",
      description: "Piket Dana Usaha pagi hari OSIS MPK SMKN 11 Bandung",
      default_late_threshold_minutes: 15,
      is_active: true,
    },
    update: {
      name: "Danusan",
      is_active: true,
    },
  });

  console.log("Activity Danusan ready:", danusan);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
