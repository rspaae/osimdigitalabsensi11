import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateScheduleSchema } from "@/lib/validators/schedule.schema";
import {
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "@/lib/services/schedule.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.SCHEDULES, PermissionAction.READ);
    const { id } = await context.params;

    const schedule = await getScheduleById(id);
    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const validatedData = updateScheduleSchema.parse(body);

    // Jika melakukan transisi status (buka/tutup sesi), periksa izin MANAGE_SESSION atau UPDATE
    const action = validatedData.status
      ? PermissionAction.MANAGE_SESSION
      : PermissionAction.UPDATE;

    await requirePermission(AppModule.SCHEDULES, action);
    const { id } = await context.params;

    const updated = await updateSchedule(id, validatedData);
    return NextResponse.json({
      success: true,
      message: "Jadwal sesi kegiatan berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.SCHEDULES, PermissionAction.DELETE);
    const { id } = await context.params;

    const result = await deleteSchedule(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
