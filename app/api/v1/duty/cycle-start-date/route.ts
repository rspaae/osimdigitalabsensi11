import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import { setCycleStartDateSchema } from "@/lib/validators/duty.schema";
import { setCycleStartDate } from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function POST(request: Request) {
  try {
    const user = await requireFreshUser();
    const body = await request.json();
    const validated = setCycleStartDateSchema.parse(body);

    const result = await setCycleStartDate(
      validated.cycle_start_date,
      user,
      validated.description
    );

    return NextResponse.json(
      {
        success: true,
        message: "Tanggal mulai siklus 14 hari berhasil dikonfigurasi.",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
