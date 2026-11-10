import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/auth/context";
import {
  createSubstitutionSchema,
  substitutionQuerySchema,
} from "@/lib/validators/duty.schema";
import {
  createSubstitution,
  getSubstitutions,
} from "@/lib/services/duty.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requireFreshUser();

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validated = substitutionQuerySchema.parse(queryParams);

    const result = await getSubstitutions(validated);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFreshUser();
    const body = await request.json();
    const validated = createSubstitutionSchema.parse(body);

    const substitution = await createSubstitution(validated, user);

    return NextResponse.json(
      {
        success: true,
        message: "Substitusi jadwal piket berhasil disetujui dan dicatat.",
        data: substitution,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
