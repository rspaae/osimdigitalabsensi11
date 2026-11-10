import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import { getCycleStatus } from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    // Membaca request URL menandai endpoint ini sebagai request-time dynamic
    void request.url;
    await requireFreshUser();
    const result = await getCycleStatus();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
