import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import {
  createMemberPositionSchema,
  memberPositionQuerySchema,
} from "@/lib/validators/member-position.schema";
import {
  getMemberPositions,
  assignMemberPosition,
} from "@/lib/services/member-position.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = memberPositionQuerySchema.parse(queryParams);

    const assignments = await getMemberPositions(validatedQuery);
    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createMemberPositionSchema.parse(body);

    const newAssignment = await assignMemberPosition(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Penugasan jabatan anggota berhasil dibuat.",
        data: newAssignment,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
