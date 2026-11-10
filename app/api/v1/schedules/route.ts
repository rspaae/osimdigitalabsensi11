import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import {
  createScheduleSchema,
  scheduleQuerySchema,
} from "@/lib/validators/schedule.schema";
import {
  getSchedules,
  createSchedule,
} from "@/lib/services/schedule.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.SCHEDULES, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = scheduleQuerySchema.parse(queryParams);

    const result = await getSchedules(validatedQuery);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.SCHEDULES, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createScheduleSchema.parse(body);

    const newSchedule = await createSchedule(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Jadwal sesi kegiatan berhasil dibuat.",
        data: newSchedule,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
