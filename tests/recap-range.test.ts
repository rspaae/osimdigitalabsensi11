import test from "node:test";
import assert from "node:assert/strict";

import { resolveRecapRange } from "../lib/utils/recap-range";

const TODAY = "2026-11-13";

test("REKAP RANGE: tanpa filter memakai 7 hari terakhir", () => {
  const range = resolveRecapRange({ today: TODAY });
  assert.equal(range.from, "2026-11-07");
  assert.equal(range.to, TODAY);
  assert.equal(range.error, null);
});

test("REKAP RANGE: filter valid dipakai apa adanya", () => {
  const range = resolveRecapRange({ from: "2026-11-01", to: "2026-11-10", today: TODAY });
  assert.equal(range.from, "2026-11-01");
  assert.equal(range.to, "2026-11-10");
  assert.equal(range.error, null);
});

test("REKAP RANGE: hanya tanggal awal, akhir default hari ini", () => {
  const range = resolveRecapRange({ from: "2026-11-05", today: TODAY });
  assert.equal(range.from, "2026-11-05");
  assert.equal(range.to, TODAY);
  assert.equal(range.error, null);
});

test("REKAP RANGE: tanggal terbalik ditolak dan kembali ke default", () => {
  const range = resolveRecapRange({ from: "2026-11-10", to: "2026-11-01", today: TODAY });
  assert.equal(range.from, "2026-11-07");
  assert.equal(range.to, TODAY);
  assert.match(range.error ?? "", /tidak boleh melewati/);
});

test("REKAP RANGE: format tanggal salah ditolak", () => {
  const range = resolveRecapRange({ from: "11-11-2026", today: TODAY });
  assert.match(range.error ?? "", /Format tanggal/);
});

test("REKAP RANGE: rentang lebih dari batas maksimum ditolak", () => {
  const range = resolveRecapRange({
    from: "2026-01-01",
    to: "2026-11-13",
    today: TODAY,
    maxDays: 62,
  });
  assert.match(range.error ?? "", /Rentang maksimal 62 hari/);
  assert.equal(range.from, "2026-11-07");
});

test("REKAP RANGE: rentang tepat pada batas maksimum diterima", () => {
  const range = resolveRecapRange({
    from: "2026-10-14",
    to: TODAY,
    today: TODAY,
    maxDays: 31,
  });
  assert.equal(range.error, null);
});
