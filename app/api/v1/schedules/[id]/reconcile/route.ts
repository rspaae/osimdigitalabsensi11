import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { reconcileSchedule } from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/schedules/[id]/reconcile
 * Menjalankan rekonsiliasi untuk satu jadwal sesi yang sudah CLOSED.
 * Membuat record ALPA untuk anggota aktif yang belum memiliki data absensi.
 * Idempoten — aman untuk dijalankan berulang kali.
 * Requires: SCHEDULES.MANAGE_SESSION
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const actingUser = await requirePermission(
      AppModule.SCHEDULES,
      PermissionAction.MANAGE_SESSION
    );

    const { id } = await context.params;
    const result = await reconcileSchedule(id, actingUser.id);

    return NextResponse.json(
      {
        success: true,
        message: `Rekonsiliasi selesai. ${result.created} record ALPA dibuat, ${result.skipped} anggota sudah memiliki data absensi.`,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
