import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import {
  attendanceQuerySchema,
  createAttendanceSchema,
} from "@/lib/validators/attendance.schema";
import {
  getAttendances,
  createManualAttendance,
} from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/services/api-handler";

/**
 * GET /api/v1/attendance
 * Daftar absensi dengan filter dan paginasi.
 * Requires: ATTENDANCE.READ
 */
export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.ATTENDANCE, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = attendanceQuerySchema.parse(queryParams);

    const result = await getAttendances(validatedQuery);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/attendance
 * Membuat absensi manual (HADIR, TERLAMBAT, IZIN, SAKIT — bukan ALPA).
 * Requires: ATTENDANCE.CREATE
 */
export async function POST(request: Request) {
  try {
    const actingUser = await requirePermission(
      AppModule.ATTENDANCE,
      PermissionAction.CREATE
    );

    const body = await request.json();
    const validatedData = createAttendanceSchema.parse(body);

    const attendance = await createManualAttendance(validatedData, actingUser.id);

    return NextResponse.json(
      {
        success: true,
        message: "Data absensi manual berhasil ditambahkan.",
        data: attendance,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
