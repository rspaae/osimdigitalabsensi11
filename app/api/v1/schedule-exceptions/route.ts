import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import { handleApiError } from "@/lib/services/api-handler";
import {
  createScheduleExceptions,
  listScheduleExceptions,
} from "@/lib/services/schedule-exception.service";
import {
  createScheduleExceptionSchema,
  scheduleExceptionQuerySchema,
} from "@/lib/validators/schedule-exception.schema";

/** GET /api/v1/schedule-exceptions?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.SYSTEM_SETTINGS, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const query = scheduleExceptionQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const items = await listScheduleExceptions(query);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/v1/schedule-exceptions — tandai libur (satu tanggal atau rentang) */
export async function POST(request: Request) {
  try {
    const user = await requirePermission(
      AppModule.SYSTEM_SETTINGS,
      PermissionAction.UPDATE
    );

    const body = await request.json();
    const input = createScheduleExceptionSchema.parse(body);
    const result = await createScheduleExceptions(input, user.id);

    return NextResponse.json(
      {
        success: true,
        message:
          result.created > 0
            ? `${result.created} tanggal ditandai libur.`
            : "Pengecualian diperbarui.",
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
