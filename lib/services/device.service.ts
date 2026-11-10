import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  RegisterDeviceInput,
  UpdateDeviceInput,
  DeviceQueryInput,
} from "@/lib/validators/device.schema";
import { NotFoundError, ConflictError } from "./errors";

/** Panjang raw API key dalam bytes (menghasilkan 48-character hex string). */
const API_KEY_BYTES = 24;
const API_KEY_SALT_ROUNDS = 10; // Lebih rendah dari password karena sering dipanggil di IoT

/**
 * Menghasilkan API key kriptografis yang aman secara acak.
 * Mengembalikan { rawKey, keyHash }.
 * rawKey hanya boleh ditampilkan sekali, TIDAK disimpan di DB.
 */
export function generateDeviceApiKey(): { rawKey: string; keyHash: Promise<string> } {
  const rawKey = randomBytes(API_KEY_BYTES).toString("hex");
  const keyHash = bcrypt.hash(rawKey, API_KEY_SALT_ROUNDS);
  return { rawKey, keyHash };
}

/**
 * Mendaftarkan perangkat IoT baru.
 * Menghasilkan API key kriptografis yang aman.
 * Mengembalikan rawKey SEKALI SAJA — tidak pernah disimpan di DB.
 * Hanya SUPERADMIN yang boleh memanggil fungsi ini.
 */
export async function registerDevice(input: RegisterDeviceInput): Promise<{
  device: {
    id: string;
    device_code: string;
    name: string;
    location: string;
    is_active: boolean;
    created_at: Date;
  };
  raw_api_key: string;
  warning: string;
}> {
  const { rawKey, keyHash } = generateDeviceApiKey();
  const resolvedHash = await keyHash;

  try {
    const device = await prisma.device.create({
      data: {
        device_code: input.device_code,
        name: input.name,
        location: input.location,
        api_key_hash: resolvedHash,
      },
      select: {
        id: true,
        device_code: true,
        name: true,
        location: true,
        is_active: true,
        created_at: true,
      },
    });

    return {
      device,
      raw_api_key: rawKey,
      warning:
        "SIMPAN API KEY INI SEKARANG. Kunci ini tidak akan ditampilkan lagi. " +
        "Masukkan ke dalam firmware sebagai DEVICE_API_KEY.",
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        `Perangkat dengan kode '${input.device_code}' sudah terdaftar.`
      );
    }
    throw error;
  }
}

/**
 * Rotasi API key perangkat yang ada.
 * Menginvalidasi key lama dan menggantinya dengan yang baru.
 * Mengembalikan rawKey baru SEKALI SAJA.
 */
export async function rotateDeviceApiKey(deviceId: string): Promise<{
  device_id: string;
  device_code: string;
  raw_api_key: string;
  warning: string;
}> {
  // Verifikasi perangkat ada
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, device_code: true },
  });

  if (!device) {
    throw new NotFoundError(`Perangkat dengan ID '${deviceId}' tidak ditemukan.`);
  }

  const { rawKey, keyHash } = generateDeviceApiKey();
  const resolvedHash = await keyHash;

  await prisma.device.update({
    where: { id: deviceId },
    data: { api_key_hash: resolvedHash },
  });

  return {
    device_id: device.id,
    device_code: device.device_code,
    raw_api_key: rawKey,
    warning:
      "API KEY LAMA SUDAH TIDAK BERLAKU. Perbarui firmware dengan API key baru ini. " +
      "Kunci ini tidak akan ditampilkan lagi.",
  };
}

/**
 * Memperbarui data perangkat (name, location, is_active).
 * Tidak mengizinkan perubahan device_code.
 */
export async function updateDevice(deviceId: string, input: UpdateDeviceInput) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new NotFoundError(`Perangkat dengan ID '${deviceId}' tidak ditemukan.`);
  }

  return prisma.device.update({
    where: { id: deviceId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    },
    select: {
      id: true,
      device_code: true,
      name: true,
      location: true,
      is_active: true,
      last_seen: true,
      created_at: true,
      updated_at: true,
    },
  });
}

/**
 * Menonaktifkan perangkat secara soft (is_active = false).
 * Menjaga riwayat sesi dan absensi yang sudah ada.
 */
export async function deactivateDevice(deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new NotFoundError(`Perangkat dengan ID '${deviceId}' tidak ditemukan.`);
  }

  return prisma.device.update({
    where: { id: deviceId },
    data: { is_active: false },
    select: {
      id: true,
      device_code: true,
      name: true,
      location: true,
      is_active: true,
    },
  });
}

/**
 * Daftar semua perangkat dengan paginasi dan filter.
 * Tidak mengembalikan api_key_hash.
 */
export async function getDevices(query: DeviceQueryInput) {
  const { page, limit, is_active, sort_by, sort_order } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.DeviceWhereInput = {};
  if (is_active !== undefined) {
    where.is_active = is_active;
  }

  const [total, devices] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort_by]: sort_order },
      select: {
        id: true,
        device_code: true,
        name: true,
        location: true,
        is_active: true,
        last_seen: true,
        created_at: true,
        updated_at: true,
        _count: { select: { schedules: true } },
      },
    }),
  ]);

  const total_pages = Math.ceil(total / limit);

  return {
    devices,
    pagination: {
      page,
      limit,
      total,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    },
  };
}

/**
 * Detail satu perangkat berdasarkan ID.
 * Tidak mengembalikan api_key_hash.
 */
export async function getDeviceById(deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      device_code: true,
      name: true,
      location: true,
      is_active: true,
      last_seen: true,
      created_at: true,
      updated_at: true,
      schedules: {
        orderBy: { date: "desc" },
        take: 10,
        select: {
          id: true,
          date: true,
          status: true,
          activity: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!device) {
    throw new NotFoundError(`Perangkat dengan ID '${deviceId}' tidak ditemukan.`);
  }

  return device;
}
