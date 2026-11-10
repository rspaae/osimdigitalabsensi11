import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updatePositionSchema } from "@/lib/validators/organization.schema";
import {
  getPositionById,
  updatePosition,
  deletePosition,
} from "@/lib/services/organization.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.READ);
    const { id } = await context.params;

    const position = await getPositionById(id);
    return NextResponse.json({ success: true, data: position });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.UPDATE);
    const { id } = await context.params;

    const body = await request.json();
    const validatedData = updatePositionSchema.parse(body);

    const updated = await updatePosition(id, validatedData);
    return NextResponse.json({
      success: true,
      message: "Data jabatan berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.DELETE);
    const { id } = await context.params;

    const result = await deletePosition(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
