import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import {
  createDutyScheduleSchema,
  cycleWeekEnum,
  dayOfWeekEnum,
} from "@/lib/validators/duty.schema";
import {
  createDutySchedule,
  getDutySchedules,
} from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requireFreshUser();

    const { searchParams } = new URL(request.url);
    const activity_id = searchParams.get("activity_id") ?? undefined;
    const cycle_week_raw = searchParams.get("cycle_week");
    const day_of_week_raw = searchParams.get("day_of_week");
    const is_active_raw = searchParams.get("is_active");

    const cycle_week = cycle_week_raw
      ? cycleWeekEnum.parse(cycle_week_raw)
      : undefined;
    const day_of_week = day_of_week_raw
      ? dayOfWeekEnum.parse(day_of_week_raw)
      : undefined;
    const is_active =
      is_active_raw !== null && is_active_raw !== undefined
        ? is_active_raw === "true"
        : undefined;

    const schedules = await getDutySchedules({
      activity_id,
      cycle_week,
      day_of_week,
      is_active,
    });

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFreshUser();
    const body = await request.json();
    const validated = createDutyScheduleSchema.parse(body);

    const schedule = await createDutySchedule(validated, user);

    return NextResponse.json(
      {
        success: true,
        message: "Jadwal piket berhasil dibuat.",
        data: schedule,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
