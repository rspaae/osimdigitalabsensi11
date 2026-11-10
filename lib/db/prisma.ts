import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Uji kesehatan koneksi basis data PostgreSQL secara aman tanpa membocorkan kredensial.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1;`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Koneksi database gagal.";
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: errorMsg,
    };
  }
}

export default prisma;
