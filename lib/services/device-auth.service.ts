import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import type { Device } from "@prisma/client";
import { AuthenticationError } from "@/lib/auth/context";

/**
 * Autentikasi perangkat IoT berdasarkan device_code dan raw API key.
 * Raw API key TIDAK PERNAH dicatat ke log.
 *
 * @param deviceCode - Kode unik perangkat (device_code di DB)
 * @param rawApiKey  - API key mentah dari header Authorization: Bearer <key>
 * @returns Device yang terautentikasi
 * @throws AuthenticationError jika perangkat tidak ditemukan, tidak aktif, atau key salah
 */
export async function authenticateDevice(
  deviceCode: string,
  rawApiKey: string
): Promise<Device> {
  // 1. Cari perangkat berdasarkan device_code
  const device = await prisma.device.findUnique({
    where: { device_code: deviceCode },
  });

  // 2. Tolak jika tidak ditemukan atau tidak aktif
  if (!device) {
    throw new AuthenticationError(
      "Autentikasi perangkat gagal: Perangkat tidak ditemukan.",
      "DEVICE_NOT_FOUND"
    );
  }

  if (!device.is_active) {
    throw new AuthenticationError(
      "Autentikasi perangkat gagal: Perangkat telah dinonaktifkan.",
      "DEVICE_INACTIVE"
    );
  }

  // 3. Verifikasi API key dengan bcrypt — raw key TIDAK dilog
  const isKeyValid = await bcrypt.compare(rawApiKey, device.api_key_hash);
  if (!isKeyValid) {
    throw new AuthenticationError(
      "Autentikasi perangkat gagal: API key tidak valid.",
      "DEVICE_AUTH_FAILED"
    );
  }

  // 4. Perbarui last_seen secara asinkron (tidak memblokir respons)
  await prisma.device.update({
    where: { id: device.id },
    data: { last_seen: new Date() },
  });

  return device;
}
