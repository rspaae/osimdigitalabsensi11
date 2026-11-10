import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import { updateDutyScheduleSchema } from "@/lib/validators/duty.schema";
import {
  getDutyScheduleById,
  updateDutySchedule,
  deleteDutySchedule,
} from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireFreshUser();
    const { id } = await params;
    const schedule = await getDutyScheduleById(id);

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireFreshUser();
    const { id } = await params;
    const body = await request.json();
    const validated = updateDutyScheduleSchema.parse(body);

    const updated = await updateDutySchedule(id, validated, user);

    return NextResponse.json({
      success: true,
      message: "Jadwal piket berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireFreshUser();
    const { id } = await params;

    const result = await deleteDutySchedule(id, user);

    return NextResponse.json({
      success: true,
      message: "Jadwal piket berhasil dihapus / dinonaktifkan.",
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
