import test from "node:test";
import assert from "node:assert/strict";

import {
  expandDateRange,
  getCancellationReason,
  isScheduleCancelled,
} from "../lib/utils/schedule-exception";

// ============================================================================
// RENTANG TANGGAL
// ============================================================================

test("LIBUR: satu tanggal menghasilkan satu entri", () => {
  assert.deepEqual(expandDateRange("2026-11-13", "2026-11-13"), ["2026-11-13"]);
});

test("LIBUR: rentang inklusif melewati pergantian bulan", () => {
  assert.deepEqual(expandDateRange("2026-11-29", "2026-12-02"), [
    "2026-11-29",
    "2026-11-30",
    "2026-12-01",
    "2026-12-02",
  ]);
});

test("LIBUR: tanggal akhir sebelum awal ditolak", () => {
  assert.throws(() => expandDateRange("2026-11-13", "2026-11-12"), /sebelum/);
});

test("LIBUR: rentang lebih dari 366 hari ditolak", () => {
  assert.throws(() => expandDateRange("2026-01-01", "2027-06-01"), /maksimal/);
});

test("LIBUR: tanggal tidak valid ditolak", () => {
  assert.throws(() => expandDateRange("bukan-tanggal", "2026-11-13"), /tidak valid/);
});

// ============================================================================
// PENERAPAN KE KEGIATAN
// ============================================================================

const SAPA = "activity-sapa";
const DANUS = "activity-danus";

test("LIBUR: pengecualian semua kegiatan membatalkan kegiatan apa pun", () => {
  const exceptions = [{ activity_id: null, reason: "Libur nasional" }];
  assert.equal(isScheduleCancelled(exceptions, SAPA), true);
  assert.equal(isScheduleCancelled(exceptions, DANUS), true);
  assert.equal(getCancellationReason(exceptions, DANUS), "Libur nasional");
});

test("LIBUR: pengecualian khusus hanya membatalkan kegiatan tersebut", () => {
  const exceptions = [{ activity_id: DANUS, reason: "Danusan ditiadakan" }];
  assert.equal(isScheduleCancelled(exceptions, DANUS), true);
  assert.equal(isScheduleCancelled(exceptions, SAPA), false);
  assert.equal(getCancellationReason(exceptions, SAPA), null);
});

test("LIBUR: tanpa pengecualian tidak ada yang dibatalkan", () => {
  assert.equal(isScheduleCancelled([], SAPA), false);
  assert.equal(getCancellationReason([], SAPA), null);
});

test("LIBUR: dua pengecualian berbeda kegiatan diproses terpisah", () => {
  const exceptions = [
    { activity_id: SAPA, reason: "Sapa Pagi libur" },
    { activity_id: DANUS, reason: "Danusan libur" },
  ];
  assert.equal(getCancellationReason(exceptions, SAPA), "Sapa Pagi libur");
  assert.equal(getCancellationReason(exceptions, DANUS), "Danusan libur");
});
