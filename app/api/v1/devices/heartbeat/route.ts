import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDevice } from "@/lib/services/device-auth.service";
import { handleApiError } from "@/lib/services/api-handler";

const heartbeatSchema = z.object({
  device_code: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9_-]+$/),
});

/** Device-only connection check. Updates last_seen without creating attendance. */
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return NextResponse.json({ success: false, code: "DEVICE_AUTH_FAILED", error: "API key perangkat wajib dikirim." }, { status: 401 });
    }

    const body = heartbeatSchema.parse(await request.json());
    const device = await authenticateDevice(body.device_code, match[1]);
    return NextResponse.json({
      success: true,
      data: { device_code: device.device_code, connected: true, server_time: new Date().toISOString() },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
