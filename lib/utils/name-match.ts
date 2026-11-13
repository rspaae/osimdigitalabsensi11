/**
 * Normalisasi nama orang untuk pencocokan roster.
 *
 * Tujuan: nama yang diketik ulang dari daftar (WhatsApp/Word) sering mengandung
 * karakter tak terlihat, spasi ganda, atau apostrof tipografis. Normalisasi ini
 * hanya dipakai untuk MENCARI kandidat; keputusan akhir tetap eksplisit dan
 * nama asli tidak pernah diubah di database.
 */
export function normalizePersonName(value: string): string {
  return value
    .normalize("NFC")
    // zero-width space/joiner/non-joiner, word joiner, BOM
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    // apostrof tipografis → apostrof biasa
    .replace(/[\u2018\u2019\u02bc`´]/g, "'")
    // spasi (termasuk non-breaking space) → satu spasi
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Membandingkan dua nama dengan aturan normalisasi yang sama. */
export function samePersonName(a: string, b: string): boolean {
  return normalizePersonName(a) === normalizePersonName(b);
}
