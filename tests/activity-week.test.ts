import test from "node:test";
import assert from "node:assert/strict";
import { CycleWeek } from "@prisma/client";

import {
  applyCycleWeekOffset,
  flipCycleWeek,
  normalizeWeekOffset,
  weekLabel,
} from "../lib/services/activity-week.service";

// ============================================================================
// ROTASI MINGGU SIKLUS PER KEGIATAN
// ============================================================================

test("SIKLUS: flip menukar WEEK_1 dan WEEK_2", () => {
  assert.equal(flipCycleWeek(CycleWeek.WEEK_1), CycleWeek.WEEK_2);
  assert.equal(flipCycleWeek(CycleWeek.WEEK_2), CycleWeek.WEEK_1);
});

test("SIKLUS: offset 0 mengikuti minggu global", () => {
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_1, 0), CycleWeek.WEEK_1);
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_2, 0), CycleWeek.WEEK_2);
});

test("SIKLUS: offset 1 memakai minggu kebalikan", () => {
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_1, 1), CycleWeek.WEEK_2);
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_2, 1), CycleWeek.WEEK_1);
});

test("SIKLUS: offset genap/negatif dinormalisasi modulo 2", () => {
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_1, 2), CycleWeek.WEEK_1);
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_1, 3), CycleWeek.WEEK_2);
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_1, -1), CycleWeek.WEEK_2);
  assert.equal(applyCycleWeekOffset(CycleWeek.WEEK_2, -2), CycleWeek.WEEK_2);
});

test("SIKLUS: normalizeWeekOffset hanya menghasilkan 0 atau 1", () => {
  for (const value of [0, 1, 2, 3, -1, -2, 10, 11]) {
    const normalized = normalizeWeekOffset(value);
    assert.ok(normalized === 0 || normalized === 1, `nilai ${value} → ${normalized}`);
  }
  assert.equal(normalizeWeekOffset(3), 1);
  assert.equal(normalizeWeekOffset(-3), 1);
});

test("SIKLUS: label minggu konsisten untuk tampilan", () => {
  assert.equal(weekLabel(CycleWeek.WEEK_1), "Minggu 1");
  assert.equal(weekLabel(CycleWeek.WEEK_2), "Minggu 2");
});

test("SIKLUS: skenario Danusan — global WEEK_1, offset 1 menjadi WEEK_2", () => {
  const globalWeek = CycleWeek.WEEK_1;
  // Sapa Pagi tanpa offset tetap Minggu 1.
  assert.equal(applyCycleWeekOffset(globalWeek, 0), CycleWeek.WEEK_1);
  // Danusan dengan offset 1 memakai daftar Minggu 2.
  assert.equal(applyCycleWeekOffset(globalWeek, 1), CycleWeek.WEEK_2);
});
