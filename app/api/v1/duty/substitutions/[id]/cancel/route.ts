import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import { cancelSubstitution } from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireFreshUser();
    const { id } = await params;

    const result = await cancelSubstitution(id, user);

    return NextResponse.json({
      success: true,
      message: "Substitusi jadwal piket berhasil dibatalkan.",
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
