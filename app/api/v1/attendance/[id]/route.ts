import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateAttendanceSchema } from "@/lib/validators/attendance.schema";
import {
  getAttendanceById,
  correctAttendance,
} from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/attendance/[id]
 * Detail satu record absensi.
 * Requires: ATTENDANCE.READ
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.ATTENDANCE, PermissionAction.READ);

    const { id } = await context.params;
    const attendance = await getAttendanceById(id);

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/attendance/[id]
 * Koreksi status absensi yang sudah ada.
 * Requires: HISTORY_CORRECTION.CORRECT
 * Wajib menyertakan `reason` minimal 10 karakter.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actingUser = await requirePermission(
      AppModule.HISTORY_CORRECTION,
      PermissionAction.CORRECT
    );

    const { id } = await context.params;
    const body = await request.json();
    const validatedData = updateAttendanceSchema.parse(body);

    const updated = await correctAttendance(id, validatedData, actingUser.id);

    return NextResponse.json({
      success: true,
      message: "Data absensi berhasil dikoreksi.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// NO DELETE — attendance records are immutable (append-only)
