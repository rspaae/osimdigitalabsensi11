import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { createCommissionSchema } from "@/lib/validators/organization.schema";
import {
  getCommissions,
  createCommission,
} from "@/lib/services/organization.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET() {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.READ);

    const commissions = await getCommissions();
    return NextResponse.json({ success: true, data: commissions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.DIVISIONS, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createCommissionSchema.parse(body);

    const newCommission = await createCommission(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Data Komisi berhasil ditambahkan.",
        data: newCommission,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
