/**
 * Utilitas konversi waktu & zona waktu resmi SMKN 11 Bandung (WIB / Asia/Jakarta = UTC+7).
 * Seluruh timestamp yang disimpan di database PostgreSQL bertipe TIMESTAMPTZ (UTC).
 */

const WIB_OFFSET_HOURS = 7;
const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Mengubah tanggal (YYYY-MM-DD) menjadi objek Date UTC tengah malam (untuk PostgreSQL DATE).
 */
export function parseDateOnlyToUtc(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error(`Format tanggal tidak valid: '${dateStr}'. Gunakan YYYY-MM-DD.`);
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0));
}

/**
 * Mengonversi waktu WIB ke UTC instant:
 * Mendukung format:
 * 1. String ISO lengkap dengan offset, misal: '2026-11-08T06:30:00+07:00' atau '2026-11-08T06:30:00Z'
 * 2. Kombinasi dateStr ('YYYY-MM-DD') dan timeStr ('HH:mm' atau 'HH:mm:ss') dalam waktu lokal WIB.
 */
export function parseWibToUtc(input: string, baseDateStr?: string): Date {
  const trimmed = input.trim();

  // Jika input sudah menyertakan offset timezone (+07:00, Z, dsb.)
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Format ISO timestamp tidak valid: '${trimmed}'`);
    }
    return parsed;
  }

  // Jika berupa waktu jam-menit 'HH:mm' atau 'HH:mm:ss'
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch && baseDateStr) {
    const dateMatch = baseDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) {
      throw new Error(`Format baseDateStr tidak valid: '${baseDateStr}'. Gunakan YYYY-MM-DD.`);
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]) - 1;
    const day = Number(dateMatch[3]);
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = Number(timeMatch[3] ?? 0);

    // Hitung waktu lokal WIB dalam milidetik UTC, lalu kurangi offset 7 jam (+07:00 -> UTC)
    const localWibUtcMs = Date.UTC(year, month, day, hours, minutes, seconds, 0);
    return new Date(localWibUtcMs - WIB_OFFSET_MS);
  }

  // Jika format datetime lokal tanpa offset: 'YYYY-MM-DDTHH:mm:ss'
  const dateTimeMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (dateTimeMatch) {
    const year = Number(dateTimeMatch[1]);
    const month = Number(dateTimeMatch[2]) - 1;
    const day = Number(dateTimeMatch[3]);
    const hours = Number(dateTimeMatch[4]);
    const minutes = Number(dateTimeMatch[5]);
    const seconds = Number(dateTimeMatch[6] ?? 0);

    const localWibUtcMs = Date.UTC(year, month, day, hours, minutes, seconds, 0);
    return new Date(localWibUtcMs - WIB_OFFSET_MS);
  }

  // Fallback standar
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Format waktu tidak valid: '${trimmed}'`);
  }
  return parsed;
}

/**
 * Format Date UTC ke format tampilan WIB (YYYY-MM-DD HH:mm:ss WIB).
 */
export function formatUtcToWibString(date: Date): string {
  const wibDate = new Date(date.getTime() + WIB_OFFSET_MS);
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibDate.getUTCDate()).padStart(2, "0");
  const hours = String(wibDate.getUTCHours()).padStart(2, "0");
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(wibDate.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} WIB`;
}
