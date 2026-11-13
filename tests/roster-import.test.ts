import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizePersonName, samePersonName } from "../lib/utils/name-match";

interface RosterEntry {
  name?: string;
  db_name?: string;
  class_grade?: string | null;
  week: string;
  day: string;
}

const roster = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/roster-danusan-2026.json"), "utf8")
) as RosterEntry[];

// ============================================================================
// NORMALISASI NAMA
// ============================================================================

test("NAMA: spasi ganda, kapital, dan zero-width dinormalisasi", () => {
  assert.equal(normalizePersonName("  Santi   Listiani "), "santi listiani");
  assert.equal(normalizePersonName("Jeanny\u2060 Wynnie"), "jeanny wynnie");
  assert.equal(normalizePersonName("Nama\u200bLengkap"), "namalengkap");
});

test("NAMA: apostrof tipografis disamakan dengan apostrof biasa", () => {
  assert.equal(
    normalizePersonName("Sakina Qurrota A’yunin"),
    normalizePersonName("Sakina Qurrota A'yunin")
  );
});

test("NAMA: pembandingan mengabaikan kapitalisasi", () => {
  assert.equal(samePersonName("Hasna listiani", "HASNA LISTIANI"), true);
  assert.equal(samePersonName("Aulia Hafiz", "Aulia Hapiz"), false);
});

// ============================================================================
// DATA ROSTER DANUSAN 2026
// ============================================================================

test("ROSTER: berisi 70 penugasan", () => {
  assert.equal(roster.length, 70);
});

test("ROSTER: setiap entri punya nama dan minggu/hari yang valid", () => {
  const validWeeks = new Set(["WEEK_1", "WEEK_2"]);
  const validDays = new Set(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
  for (const entry of roster) {
    assert.ok(entry.name && entry.name.trim().length > 0, "nama wajib ada");
    assert.ok(validWeeks.has(entry.week), `minggu tidak valid: ${entry.week}`);
    assert.ok(validDays.has(entry.day), `hari tidak valid: ${entry.day}`);
    if (entry.db_name) {
      assert.notEqual(
        normalizePersonName(entry.db_name),
        normalizePersonName(entry.name!),
        `alias db_name tidak perlu jika sama: ${entry.name}`
      );
    }
  }
});

test("ROSTER: setiap hari berisi 7 orang (10 slot)", () => {
  const counts = new Map<string, number>();
  for (const entry of roster) {
    const key = `${entry.week}:${entry.day}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const week of ["WEEK_1", "WEEK_2"]) {
    for (const day of ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]) {
      assert.equal(counts.get(`${week}:${day}`), 7, `${week} ${day}`);
    }
  }
  assert.equal([...counts.values()].reduce((total, value) => total + value, 0), 70);
});

test("ROSTER: perbaikan penempatan Alena, Reza, dan Erika", () => {
  const has = (name: string, week: string, day: string) =>
    roster.some(
      (entry) =>
        normalizePersonName(entry.name ?? "") === normalizePersonName(name) &&
        entry.week === week &&
        entry.day === day
    );

  // Alena masuk Kamis Minggu 1 menggantikan Reza.
  assert.equal(has("Alena Veyra Pramudita", "WEEK_1", "THURSDAY"), true);
  assert.equal(has("Reza Maulana Dhabit", "WEEK_1", "THURSDAY"), false);

  // Reza pindah ke Senin Minggu 2 menggantikan Erika.
  assert.equal(has("Reza Maulana Dhabit", "WEEK_2", "MONDAY"), true);
  assert.equal(has("Erika Febriyanti", "WEEK_2", "MONDAY"), false);

  // Erika ditambahkan ke Jumat Minggu 2 (slot menjadi 7 orang).
  assert.equal(has("Erika Febriyanti", "WEEK_2", "FRIDAY"), true);
});

test("ROSTER: tidak ada nama ganda pada satu hari", () => {
  const seen = new Map<string, Set<string>>();
  for (const entry of roster) {
    const slot = `${entry.week}:${entry.day}`;
    const names = seen.get(slot) ?? new Set<string>();
    const key = normalizePersonName(entry.db_name ?? entry.name!);
    assert.equal(names.has(key), false, `duplikat ${entry.name} pada ${slot}`);
    names.add(key);
    seen.set(slot, names);
  }
});

test("ROSTER: seluruh alias db_name unik per hari", () => {
  const aliases = roster.filter((entry) => entry.db_name);
  assert.equal(aliases.length, 8);
  for (const alias of aliases) {
    assert.ok(alias.db_name && alias.db_name.length > 0);
  }
});
