import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateMemberSchema } from "@/lib/validators/member.schema";
import {
  getMemberById,
  updateMember,
  deleteMember,
} from "@/lib/services/member.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.MEMBERS, PermissionAction.READ);
    const { id } = await context.params;

    const member = await getMemberById(id);
    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.MEMBERS, PermissionAction.UPDATE);
    const { id } = await context.params;

    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    const updated = await updateMember(id, validatedData);
    return NextResponse.json({
      success: true,
      message: "Data anggota berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.MEMBERS, PermissionAction.DELETE);
    const { id } = await context.params;

    const result = await deleteMember(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
