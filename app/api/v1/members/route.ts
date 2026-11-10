import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { AppModule, PermissionAction } from "@/types/auth";
import {
  createMemberSchema,
  memberQuerySchema,
} from "@/lib/validators/member.schema";
import {
  getMembers,
  createMember,
} from "@/lib/services/member.service";
import { handleApiError } from "@/lib/services/api-handler";

export async function GET(request: Request) {
  try {
    await requirePermission(AppModule.MEMBERS, PermissionAction.READ);

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = memberQuerySchema.parse(queryParams);

    const result = await getMembers(validatedQuery);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(AppModule.MEMBERS, PermissionAction.CREATE);

    const body = await request.json();
    const validatedData = createMemberSchema.parse(body);

    const newMember = await createMember(validatedData);
    return NextResponse.json(
      {
        success: true,
        message: "Data anggota baru berhasil ditambahkan.",
        data: newMember,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
