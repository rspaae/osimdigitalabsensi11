import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { rotateDeviceApiKey } from "@/lib/services/device.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/devices/[id]/rotate-key
 * Merotasi API key perangkat IoT.
 * Key lama diinvalidasi seketika; raw key baru dikembalikan SEKALI SAJA.
 * Requires: SUPERADMIN only
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.IOT_DEVICES, PermissionAction.UPDATE);

    const { id } = await context.params;
    const result = await rotateDeviceApiKey(id);

    return NextResponse.json(
      {
        success: true,
        message: "API key perangkat berhasil dirotasi. Key lama sudah tidak berlaku.",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
