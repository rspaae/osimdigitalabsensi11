import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReportFileName,
  calculateRate,
  escapeCsvCell,
  toCsv,
} from "../lib/utils/report-format";

// ============================================================================
// CSV EXPORT
// ============================================================================

test("CSV: nilai biasa ditulis apa adanya", () => {
  assert.equal(escapeCsvCell("Rania Azzahra"), "Rania Azzahra");
  assert.equal(escapeCsvCell(12), "12");
  assert.equal(escapeCsvCell(null), "");
  assert.equal(escapeCsvCell(undefined), "");
});

test("CSV: nilai dengan pembatas / kutip / baris baru dibungkus kutip ganda", () => {
  assert.equal(escapeCsvCell("OSIS; MPK"), '"OSIS; MPK"');
  assert.equal(escapeCsvCell('Nama "Panggilan"'), '"Nama ""Panggilan"""');
  assert.equal(escapeCsvCell("baris 1\nbaris 2"), '"baris 1\nbaris 2"');
});

test("CSV: baris digabung dengan pemisah titik koma dan CRLF", () => {
  const csv = toCsv([
    ["No", "Nama", "Kelas"],
    [1, "Rania Azzahra", "XI RPL 2"],
    [2, "Bagas; Prakoso", null],
  ]);

  assert.equal(
    csv,
    ["No;Nama;Kelas", "1;Rania Azzahra;XI RPL 2", '2;"Bagas; Prakoso";'].join("\r\n")
  );
});

test("CSV: nama file hanya memakai tanggal yang aman", () => {
  assert.equal(
    buildReportFileName("2026-11-01", "2026-11-30"),
    "laporan-kehadiran_2026-11-01_2026-11-30.csv"
  );
});

// ============================================================================
// PERSENTASE KEHADIRAN
// ============================================================================

test("RATE: (hadir + terlambat) dibagi jumlah sesi", () => {
  assert.equal(calculateRate({ HADIR: 8, TERLAMBAT: 2 }, 10), 100);
  assert.equal(calculateRate({ HADIR: 5, TERLAMBAT: 0 }, 10), 50);
  assert.equal(calculateRate({ HADIR: 0, TERLAMBAT: 0 }, 10), 0);
});

test("RATE: izin/sakit/alpa tidak dihitung hadir", () => {
  assert.equal(calculateRate({ HADIR: 3, TERLAMBAT: 1 }, 8), 50);
});

test("RATE: null bila periode tidak punya sesi", () => {
  assert.equal(calculateRate({ HADIR: 0, TERLAMBAT: 0 }, 0), null);
  assert.equal(calculateRate({ HADIR: 5, TERLAMBAT: 0 }, -1), null);
});

test("RATE: hasil dibulatkan ke bilangan bulat terdekat", () => {
  assert.equal(calculateRate({ HADIR: 1, TERLAMBAT: 0 }, 3), 33);
  assert.equal(calculateRate({ HADIR: 2, TERLAMBAT: 0 }, 3), 67);
});
