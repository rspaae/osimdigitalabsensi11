import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    log: ["error"],
  });

  const startTime = Date.now();

  try {
    process.stdout.write("Connecting to PostgreSQL database...\n");
    await prisma.$connect();
    
    // Execute lightweight query
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    const latency = Date.now() - startTime;

    process.stdout.write("STATUS: SUCCESS\n");
    process.stdout.write(`LATENCY: ${latency}ms\n`);
    if (result && result.length > 0) {
      const fullVersion = result[0].version;
      const shortVersion = fullVersion.split("\n")[0].split(",")[0];
      process.stdout.write(`SERVER: ${shortVersion}\n`);
    }
  } catch (error: unknown) {
    process.stdout.write("STATUS: FAILED\n");
    if (error instanceof Error) {
      process.stdout.write(`ERROR_MESSAGE: ${error.message}\n`);
    } else {
      process.stdout.write(`ERROR_MESSAGE: ${String(error)}\n`);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
