import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { updateDeviceSchema } from "@/lib/validators/device.schema";
import {
  getDeviceById,
  updateDevice,
  deactivateDevice,
} from "@/lib/services/device.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/devices/[id]
 * Detail perangkat IoT. Tidak mengembalikan api_key_hash.
 * Requires: IOT_DEVICES.READ
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.IOT_DEVICES, PermissionAction.READ);

    const { id } = await context.params;
    const device = await getDeviceById(id);

    return NextResponse.json({ success: true, data: device });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/devices/[id]
 * Memperbarui name, location, atau is_active.
 * Requires: SUPERADMIN (IOT_DEVICES.UPDATE — not exposed to ADMIN)
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.IOT_DEVICES, PermissionAction.UPDATE);

    const { id } = await context.params;
    const body = await request.json();
    const validatedData = updateDeviceSchema.parse(body);

    const device = await updateDevice(id, validatedData);

    return NextResponse.json({
      success: true,
      message: "Data perangkat berhasil diperbarui.",
      data: device,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/devices/[id]
 * Menonaktifkan perangkat secara soft (is_active = false).
 * Menjaga riwayat sesi dan absensi.
 * Requires: SUPERADMIN only
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppModule.IOT_DEVICES, PermissionAction.DELETE);

    const { id } = await context.params;
    const device = await deactivateDevice(id);

    return NextResponse.json({
      success: true,
      message: `Perangkat '${device.device_code}' berhasil dinonaktifkan.`,
      data: device,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
