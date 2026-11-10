import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import { assignRosterSchema } from "@/lib/validators/duty.schema";
import { addRosterMembers } from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireFreshUser();
    const { id } = await params;
    const body = await request.json();
    const validated = assignRosterSchema.parse(body);

    const result = await addRosterMembers(id, validated.member_ids, user);

    return NextResponse.json({
      success: true,
      message: `${result.added_count} anggota baru ditambahkan ke roster.`,
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
