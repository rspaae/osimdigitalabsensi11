import { ValidationError } from "@/lib/services/errors";

/**
 * Normalisasi RFID UID ke format kanonikal:
 * - Huruf besar hexadecimal tanpa pemisah (titik dua, tanda hubung, spasi).
 * - Setiap byte dinyatakan tepat 2 karakter (panjang genap).
 * - Wajib hanya karakter heksadesimal 0-9 dan A-F.
 * - Panjang standar kartu RFID: 4-byte (8 hex chars, e.g. MIFARE Classic),
 *   7-byte (14 hex chars, e.g. MIFARE Ultralight), atau 10-byte (20 hex chars).
 *
 * Contoh hasil kanonikal:
 * - "5C45059E"
 * - "878FC201"
 * - "0A1B05FF"
 */
export function normalizeRfidUid(rawUid: string): string {
  if (!rawUid || typeof rawUid !== "string") {
    throw new ValidationError(
      "UID RFID tidak boleh kosong.",
      undefined,
      "RFID_EMPTY"
    );
  }

  // Hapus semua pemisah: titik dua (:), hyphen (-), spasi
  const cleaned = rawUid.trim().replace(/[:\-\s]/g, "").toUpperCase();

  if (cleaned.length === 0) {
    throw new ValidationError(
      "UID RFID tidak boleh kosong.",
      undefined,
      "RFID_EMPTY"
    );
  }

  // Wajib hanya karakter heksadesimal valid (0-9, A-F)
  if (!/^[0-9A-F]+$/.test(cleaned)) {
    throw new ValidationError(
      `UID RFID '${rawUid}' mengandung karakter tidak valid. Hanya karakter heksadesimal (0-9, A-F) yang diizinkan.`,
      undefined,
      "RFID_INVALID_HEX"
    );
  }

  // Panjang byte harus genap (tiap byte terdiri dari tepat 2 karakter hex)
  if (cleaned.length % 2 !== 0) {
    throw new ValidationError(
      `UID RFID '${cleaned}' memiliki panjang ganjil (${cleaned.length} karakter). Setiap byte harus bernilai tepat 2 karakter heksadesimal.`,
      undefined,
      "RFID_ODD_LENGTH"
    );
  }

  // Panjang standar kartu RFID MIFARE adalah 8 hex (4 byte), 14 hex (7 byte), atau 20 hex (10 byte)
  if (cleaned.length < 8 || cleaned.length > 20) {
    throw new ValidationError(
      `UID RFID '${cleaned}' memiliki panjang tidak valid (${cleaned.length} karakter). Panjang UID harus antara 8 hingga 20 karakter heksadesimal (4–10 byte).`,
      undefined,
      "RFID_INVALID_LENGTH"
    );
  }

  return cleaned;
}

/**
 * Validasi apakah UID dalam format kanonikal yang valid (tanpa melempar exception).
 */
export function isValidCanonicalRfidUid(uid: string): boolean {
  return /^[0-9A-F]{8,20}$/.test(uid) && uid.length % 2 === 0;
}
