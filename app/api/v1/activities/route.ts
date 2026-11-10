import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import {
  createActivitySchema,
  activityQuerySchema,
} from "@/lib/validators/activity.schema";
import {
  getActivities,
  createActivity,
} from "@/lib/services/activity.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.ACTIVITIES, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = activityQuerySchema.parse(queryParams);

    const result = await getActivities(validatedQuery);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.ACTIVITIES, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createActivitySchema.parse(body);

    const newActivity = await createActivity(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Kegiatan baru berhasil ditambahkan.",
        data: newActivity,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
