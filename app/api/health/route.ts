import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/prisma";

export async function GET() {
  const dbHealth = await checkDatabaseHealth();
  const timestamp = new Date().toISOString();

  const isHealthy = dbHealth.connected;
  const status = isHealthy ? "healthy" : "degraded";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status,
      application: "OSIS MPK Attendance & Management System",
      timestamp,
      database: {
        status: dbHealth.connected ? "connected" : "disconnected",
        latencyMs: dbHealth.latencyMs,
      },
    },
    { status: statusCode }
  );
}
