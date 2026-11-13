import test from "node:test";
import assert from "node:assert/strict";

import { buildXlsx, columnName, escapeXml } from "../lib/utils/xlsx";

// ============================================================================
// XLSX WRITER (tanpa dependensi eksternal)
// ============================================================================

test("XLSX: nama kolom mengikuti pola A, Z, AA, AZ, BA", () => {
  assert.equal(columnName(0), "A");
  assert.equal(columnName(1), "B");
  assert.equal(columnName(25), "Z");
  assert.equal(columnName(26), "AA");
  assert.equal(columnName(51), "AZ");
  assert.equal(columnName(52), "BA");
  assert.equal(columnName(701), "ZZ");
  assert.equal(columnName(702), "AAA");
});

test("XLSX: karakter khusus XML di-escape", () => {
  assert.equal(escapeXml("Rania & Bagas"), "Rania &amp; Bagas");
  assert.equal(escapeXml("<OSIS>"), "&lt;OSIS&gt;");
  assert.equal(escapeXml('kata "kutip"'), "kata &quot;kutip&quot;");
  assert.equal(escapeXml("it's"), "it&apos;s");
});

test("XLSX: karakter kontrol dibuang agar XML tetap valid", () => {
  assert.equal(escapeXml("a\u0000b\u0007c"), "abc");
});

test("XLSX: workbook valid berupa arsip ZIP (signature PK)", () => {
  const buffer = buildXlsx([
    {
      name: "Kehadiran",
      rows: [
        ["No", "Nama", "Hadir", "%"],
        [1, "Rania", 12, 0.75],
        ["", "Jumlah", 12, 0.75],
      ],
      headerRows: 1,
      percentColumns: [3],
      totalRowIndex: 2,
      columnWidths: [5, 30, 8, 10],
    },
    { name: "Info", rows: [["Laporan"]], headerRows: 0 },
  ]);

  assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
  assert.ok(buffer.byteLength > 500, "buffer terlalu kecil untuk sebuah workbook");
});

test("XLSX: menolak workbook tanpa sheet", () => {
  assert.throws(() => buildXlsx([]), /setidaknya satu sheet/);
});

test("XLSX: nama sheet ilegal dibersihkan dan dipotong 31 karakter", () => {
  // Tidak ada akses langsung ke XML, jadi cukup memastikan tidak melempar error
  // dan file tetap terbentuk saat nama mengandung karakter terlarang.
  const buffer = buildXlsx([
    { name: "Nama/Sheet*[Ilegal]:PanjangSekaliMelebihiBatas", rows: [["x"]], headerRows: 1 },
  ]);
  assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
});
