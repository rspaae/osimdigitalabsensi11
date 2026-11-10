import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { getScheduleAttendance } from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/schedules/[id]/attendance
 * Mengambil semua data absensi untuk satu jadwal sesi.
 * Requires: SCHEDULES.READ
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.SCHEDULES, PermissionAction.READ);

    const { id } = await context.params;
    const result = await getScheduleAttendance(id);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
