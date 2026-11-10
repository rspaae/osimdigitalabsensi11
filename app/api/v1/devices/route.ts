import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import {
  registerDeviceSchema,
  deviceQuerySchema,
} from "@/lib/validators/device.schema";
import {
  registerDevice,
  getDevices,
} from "@/lib/services/device.service";
import { handleApiError } from "@/lib/services/api-handler";

/**
 * GET /api/v1/devices
 * Daftar perangkat IoT yang terdaftar.
 * Requires: IOT_DEVICES.READ (ADMIN GENERAL or SUPERADMIN)
 */
export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.IOT_DEVICES, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = deviceQuerySchema.parse(queryParams);

    const result = await getDevices(validatedQuery);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/devices
 * Mendaftarkan perangkat IoT baru dan menghasilkan API key.
 * Raw API key dikembalikan SEKALI SAJA — tidak pernah disimpan di DB.
 * Requires: SUPERADMIN only (via IOT_DEVICES module with CREATE action)
 */
export async function POST(request: Request) {
  try {
    // IOT_DEVICES CREATE hanya untuk SUPERADMIN berdasarkan RBAC matrix
    await requirePermission(AppModule.IOT_DEVICES, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = registerDeviceSchema.parse(body);

    const result = await registerDevice(validatedData);

    return NextResponse.json(
      {
        success: true,
        message: "Perangkat berhasil didaftarkan.",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
