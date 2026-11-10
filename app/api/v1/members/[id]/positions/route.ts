import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { getMemberPositions } from "@/lib/services/member-position.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.MEMBERS, PermissionAction.READ);
    const { id } = await context.params;

    const { searchParams } = new URL(request.url);
    const is_active_param = searchParams.get("is_active");
    const is_active =
      is_active_param === "true"
        ? true
        : is_active_param === "false"
        ? false
        : undefined;

    const positions = await getMemberPositions({
      member_id: id,
      is_active,
    });

    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    return handleApiError(error);
  }
}
