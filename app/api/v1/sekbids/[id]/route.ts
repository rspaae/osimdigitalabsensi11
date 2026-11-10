import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateSekbidSchema } from "@/lib/validators/organization.schema";
import {
  getSekbidById,
  updateSekbid,
  deleteSekbid,
} from "@/lib/services/organization.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.READ);
    const { id } = await context.params;

    const sekbid = await getSekbidById(id);
    return NextResponse.json({ success: true, data: sekbid });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.UPDATE);
    const { id } = await context.params;

    const body = await request.json();
    const validatedData = updateSekbidSchema.parse(body);

    const updated = await updateSekbid(id, validatedData);
    return NextResponse.json({
      success: true,
      message: "Data Sekbid berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.DELETE);
    const { id } = await context.params;

    const result = await deleteSekbid(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
