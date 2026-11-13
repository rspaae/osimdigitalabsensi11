import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { handleApiError } from "@/lib/services/api-handler";
import { deleteScheduleException } from "@/lib/services/schedule-exception.service";

/** DELETE /api/v1/schedule-exceptions/[id] — batalkan status libur */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(
      AppModule.SYSTEM_SETTINGS,
      PermissionAction.UPDATE
    );
    const { id } = await context.params;

    await deleteScheduleException(id, user.id);
    return NextResponse.json({ success: true, message: "Pengecualian dihapus." });
  } catch (error) {
    return handleApiError(error);
  }
}
