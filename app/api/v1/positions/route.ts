import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { OrganizationType } from "@prisma/client";
import { createPositionSchema } from "@/lib/validators/organization.schema";
import {
  getPositions,
  createPosition,
} from "@/lib/services/organization.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const orgTypeParam = searchParams.get("organization_type");
    const organizationType =
      orgTypeParam && Object.values(OrganizationType).includes(orgTypeParam as OrganizationType)
        ? (orgTypeParam as OrganizationType)
        : undefined;

    const positions = await getPositions(organizationType);
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.EXECUTIVES, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createPositionSchema.parse(body);

    const newPosition = await createPosition(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Jabatan baru berhasil dibuat.",
        data: newPosition,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
