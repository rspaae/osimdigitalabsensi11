import { NextResponse } from "next/server";
import { rfidScanSchema } from "@/lib/validators/attendance.schema";
import { recordRfidAttendance } from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/services/api-handler";
import { AuthenticationError } from "@/lib/auth/context";

/**
 * POST /api/v1/attendance/scan
 * Endpoint publik untuk pemindaian RFID dari perangkat ESP32.
 * Autentikasi menggunakan device API key dari header Authorization: Bearer <raw_key>
 * — BUKAN cookie sesi web.
 */
export async function POST(request: Request) {
  try {
    // 1. Baca raw API key dari header Authorization: Bearer <key>
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError(
        "Header Authorization: Bearer <api_key> wajib disertakan."
      );
    }
    const rawApiKey = authHeader.slice(7).trim();
    if (!rawApiKey) {
      throw new AuthenticationError(
        "API key perangkat tidak boleh kosong."
      );
    }

    // 2. Parse dan validasi body
    const body = await request.json();
    const validated = rfidScanSchema.parse(body);

    // 3. Proses pemindaian RFID
    const result = await recordRfidAttendance(
      validated.device_code,
      rawApiKey,
      validated.rfid_uid
    );

    // 4. Kembalikan respons minimal (tanpa data sensitif)
    return NextResponse.json(
      {
        success: true,
        message: "Absensi berhasil dicatat.",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
