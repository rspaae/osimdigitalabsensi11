import { NextResponse } from "next/server";
import { setupInitialSuperadmin } from "@/lib/auth/setup.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await setupInitialSuperadmin(body);

    if (!result.success) {
      const isForbidden =
        result.error?.includes("tidak sah") ||
        result.error?.includes("sudah ada") ||
        result.error?.includes("belum dikonfigurasi");

      return NextResponse.json(
        { error: result.error },
        { status: isForbidden ? 403 : 400 }
      );
    }

    return NextResponse.json(
      {
        message: "Akun SUPERADMIN perdana berhasil diinisialisasi.",
        user: result.user,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Payload request tidak valid atau bukan format JSON." },
      { status: 400 }
    );
  }
}
