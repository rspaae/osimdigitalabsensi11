import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateActivitySchema } from "@/lib/validators/activity.schema";
import {
  getActivityById,
  updateActivity,
  deleteActivity,
} from "@/lib/services/activity.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.ACTIVITIES, PermissionAction.READ);
    const { id } = await context.params;

    const activity = await getActivityById(id);
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.ACTIVITIES, PermissionAction.UPDATE);
    const { id } = await context.params;

    const body = await request.json();
    const validatedData = updateActivitySchema.parse(body);

    const updated = await updateActivity(id, validatedData);
    return NextResponse.json({
      success: true,
      message: "Data kegiatan berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.ACTIVITIES, PermissionAction.DELETE);
    const { id } = await context.params;

    const result = await deleteActivity(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
