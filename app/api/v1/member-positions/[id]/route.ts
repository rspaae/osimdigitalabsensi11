import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateMemberPositionSchema } from "@/lib/validators/member-position.schema";
import {
  getMemberPositionById,
  updateMemberPosition,
  deleteMemberPosition,
} from "@/lib/services/member-position.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.READ);
    const { id } = await context.params;

    const assignment = await getMemberPositionById(id);
    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.UPDATE);
    const { id } = await context.params;

    const body = await request.json();
    const validatedData = updateMemberPositionSchema.parse(body);

    const updated = await updateMemberPosition(id, validatedData);
    return NextResponse.json({
      success: true,
      message: "Penugasan jabatan berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.DELETE);
    const { id } = await context.params;

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";

    const result = await deleteMemberPosition(id, !hardDelete);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
