import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { createSekbidSchema } from "@/lib/validators/organization.schema";
import {
  getSekbids,
  createSekbid,
} from "@/lib/services/organization.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET() {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.READ);

    const sekbids = await getSekbids();
    return NextResponse.json({ success: true, data: sekbids });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createSekbidSchema.parse(body);

    const newSekbid = await createSekbid(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Data Sekbid berhasil ditambahkan.",
        data: newSekbid,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
