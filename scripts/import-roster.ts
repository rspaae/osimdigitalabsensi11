/**
 * import-roster.ts
 *
 * Mengimpor roster piket (Sapa Pagi / Danusan) dari file JSON ke DutyRosterMember.
 *
 * PENGGUNAAN:
 *   npx tsx --env-file-if-exists=.env scripts/import-roster.ts \
 *     --input scripts/roster-danusan-2026.json --activity DANUSAN --dry-run
 *
 * OPSI:
 *   --input <path>       File JSON roster (default: scripts/roster-data.json)
 *   --activity <code>     Kode aktivitas (default: SAPA_PAGI)
 *   --dry-run             Simulasi; tidak menulis apa pun ke database
 *   --create-schedules    Buat DutySchedule yang belum ada untuk kombinasi
 *                         minggu/hari yang dipakai file (butuh --start/--cutoff)
 *   --start <HH:MM>       Jam mulai untuk jadwal baru (default 05:30)
 *   --cutoff <HH:MM>      Cutoff untuk jadwal baru (default 06:00)
 *   --replace             Hapus roster lama HANYA pada jadwal yang dipakai file,
 *                         lalu isi ulang. Dibatalkan bila ada entri tidak cocok.
 *
 * FORMAT FILE JSON:
 *   [
 *     { "name": "Nama Lengkap", "class_grade": "XI RPL 1", "week": "WEEK_1", "day": "MONDAY" },
 *     { "name": "Nama di daftar", "db_name": "Nama di database", ... }
 *   ]
 *
 * - `nis` (jika ada) diprioritaskan; selain itu `db_name` (alias eksplisit) atau `name`.
 * - Pencocokan nama memakai normalisasi (spasi ganda, karakter tak terlihat,
 *   apostrof tipografis) tetapi tetap EXACT setelah normalisasi — tanpa fuzzy match.
 * - Bila ada beberapa anggota bernama sama, `class_grade` dipakai untuk memilih;
 *   bila tetap ambigu, entri dilewati dan dilaporkan.
 * - Script TIDAK membuat anggota baru dan TIDAK menebak identitas.
 * - Idempoten: penugasan yang sudah ada tidak diduplikasi.
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient, MemberStatus } from "@prisma/client";
import { normalizePersonName } from "../lib/utils/name-match";

const prisma = new PrismaClient();

// ─── Argumen CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string, fallback?: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : fallback;
};
const hasFlag = (flag: string) => args.includes(flag);

const inputPath = getArg("--input", path.join(__dirname, "roster-data.json"));
const activityCode = getArg("--activity", "SAPA_PAGI")!;
const isDryRun = hasFlag("--dry-run");
const createSchedules = hasFlag("--create-schedules");
const replaceRoster = hasFlag("--replace");
const startTime = getArg("--start", "05:30")!;
const cutoffTime = getArg("--cutoff", "06:00")!;

// ─── Tipe Data Input ─────────────────────────────────────────────────────────

type Week = "WEEK_1" | "WEEK_2";
type Day =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

interface RosterEntry {
  nis?: string;
  name?: string;
  /** Nama persis di database bila ejaan pada daftar berbeda. */
  db_name?: string;
  class_grade?: string | null;
  week: Week;
  day: Day;
}

interface MemberRecord {
  id: string;
  full_name: string;
  nis: string | null;
  class_grade: string | null;
  status: MemberStatus;
  organization_type: string;
}

const VALID_WEEKS = new Set<string>(["WEEK_1", "WEEK_2"]);
const VALID_DAYS = new Set<string>([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

function validateEntry(entry: unknown, index: number): entry is RosterEntry {
  if (typeof entry !== "object" || entry === null) {
    console.error(`[SKIP] Baris ${index}: bukan objek JSON.`);
    return false;
  }
  const e = entry as Record<string, unknown>;
  if (!e.nis && !e.name) {
    console.error(`[SKIP] Baris ${index}: tidak memiliki field "nis" atau "name".`);
    return false;
  }
  if (!VALID_WEEKS.has(String(e.week))) {
    console.error(`[SKIP] Baris ${index}: "week" tidak valid ("${e.week}").`);
    return false;
  }
  if (!VALID_DAYS.has(String(e.day))) {
    console.error(`[SKIP] Baris ${index}: "day" tidak valid ("${e.day}").`);
    return false;
  }
  return true;
}

// ─── Pencocokan anggota ──────────────────────────────────────────────────────

interface Resolution {
  entry: RosterEntry;
  index: number;
  member?: MemberRecord;
  reason?: "UNMATCHED" | "AMBIGUOUS" | "INACTIVE";
  candidates?: MemberRecord[];
}

function resolveMember(
  entry: RosterEntry,
  index: number,
  byNis: Map<string, MemberRecord>,
  byName: Map<string, MemberRecord[]>
): Resolution {
  if (entry.nis) {
    const member = byNis.get(entry.nis);
    if (!member) return { entry, index, reason: "UNMATCHED" };
    if (member.status !== MemberStatus.ACTIVE) {
      return { entry, index, member, reason: "INACTIVE" };
    }
    return { entry, index, member };
  }

  const lookupName = entry.db_name ?? entry.name ?? "";
  let candidates = byName.get(normalizePersonName(lookupName)) ?? [];

  if (candidates.length === 0) {
    return { entry, index, reason: "UNMATCHED" };
  }

  // Utamakan anggota aktif.
  const active = candidates.filter((member) => member.status === MemberStatus.ACTIVE);
  if (active.length > 0) candidates = active;

  if (candidates.length > 1 && entry.class_grade) {
    const wanted = entry.class_grade.trim().toLowerCase();
    const sameClass = candidates.filter(
      (member) => (member.class_grade ?? "").trim().toLowerCase() === wanted
    );
    if (sameClass.length === 1) return { entry, index, member: sameClass[0] };
    if (sameClass.length > 1) candidates = sameClass;
  }

  if (candidates.length === 1) {
    if (candidates[0].status !== MemberStatus.ACTIVE) {
      return { entry, index, member: candidates[0], reason: "INACTIVE" };
    }
    return { entry, index, member: candidates[0] };
  }

  return { entry, index, reason: "AMBIGUOUS", candidates };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(64));
  console.log("  IMPORT ROSTER PIKET");
  console.log("=".repeat(64));
  console.log(`Input      : ${inputPath}`);
  console.log(`Aktivitas  : ${activityCode}`);
  console.log(`Mode       : ${isDryRun ? "DRY RUN (tidak ada perubahan tersimpan)" : "LIVE"}`);
  if (replaceRoster) console.log("Replace    : ya (roster pada jadwal terkait diganti)");
  if (createSchedules) console.log(`Jadwal baru: ${startTime}-${cutoffTime} WIB`);
  console.log("");

  if (!fs.existsSync(inputPath!)) {
    console.error(`File input tidak ditemukan: ${inputPath}`);
    process.exit(1);
  }

  let entries: unknown[];
  try {
    entries = JSON.parse(fs.readFileSync(inputPath!, "utf-8"));
  } catch {
    console.error("File JSON tidak valid.");
    process.exit(1);
  }
  if (!Array.isArray(entries)) {
    console.error("File JSON harus berupa array.");
    process.exit(1);
  }
  console.log(`Total entri di file: ${entries.length}`);

  // 1. Aktivitas
  const activity = await prisma.activity.findFirst({ where: { code: activityCode } });
  if (!activity) {
    console.error(`Aktivitas "${activityCode}" tidak ditemukan. Buat dulu melalui dashboard/API.`);
    process.exit(1);
  }
  console.log(`OK Aktivitas: ${activity.name} (${activity.id})`);

  // 2. DutySchedule yang sudah ada
  const validEntries = entries.filter((entry, i): entry is RosterEntry =>
    validateEntry(entry, i + 1)
  );
  const neededCombos = new Set(validEntries.map((entry) => `${entry.week}:${entry.day}`));

  const scheduleMap = new Map<string, string>();
  for (const schedule of await prisma.dutySchedule.findMany({
    where: { activity_id: activity.id },
    select: { id: true, cycle_week: true, day_of_week: true },
  })) {
    scheduleMap.set(`${schedule.cycle_week}:${schedule.day_of_week}`, schedule.id);
  }

  const missingCombos = [...neededCombos].filter((combo) => !scheduleMap.has(combo));
  console.log(`OK DutySchedule: ${scheduleMap.size} ada, ${missingCombos.length} belum ada`);

  if (missingCombos.length > 0) {
    if (!createSchedules) {
      console.error("");
      console.error("Jadwal berikut belum ada. Jalankan ulang dengan --create-schedules:");
      for (const combo of missingCombos) console.error(`  - ${combo.replace(":", " / ")}`);
      process.exit(1);
    }

    if (isDryRun) {
      console.log(`[DRY RUN] Akan membuat ${missingCombos.length} DutySchedule: ${missingCombos.join(", ")}`);
    } else {
      for (const combo of missingCombos) {
        const [week, day] = combo.split(":");
        const created = await prisma.dutySchedule.create({
          data: {
            activity_id: activity.id,
            cycle_week: week as Week,
            day_of_week: day as Day,
            start_time_wib: startTime,
            cutoff_time_wib: cutoffTime,
            title: `${activity.name} ${week === "WEEK_1" ? "Minggu 1" : "Minggu 2"} - ${day}`,
            is_active: true,
          },
          select: { id: true },
        });
        scheduleMap.set(combo, created.id);
        console.log(`[CREATE] DutySchedule ${week} ${day}`);
      }
    }
  }

  // 3. Anggota + indeks pencarian
  const members = await prisma.member.findMany({
    select: {
      id: true,
      full_name: true,
      nis: true,
      class_grade: true,
      status: true,
      organization_type: true,
    },
  });
  const byNis = new Map<string, MemberRecord>();
  const byName = new Map<string, MemberRecord[]>();
  for (const member of members) {
    if (member.nis) byNis.set(member.nis, member);
    const key = normalizePersonName(member.full_name);
    const list = byName.get(key) ?? [];
    list.push(member);
    byName.set(key, list);
  }
  console.log(`OK Anggota dimuat: ${members.length}`);

  // 4. Rencana pencocokan (baca-saja)
  const resolutions = validEntries.map((entry, index) =>
    resolveMember(entry, index + 1, byNis, byName)
  );
  const resolved = resolutions.filter((r) => r.member && !r.reason);
  const unresolved = resolutions.filter((r) => r.reason);

  console.log(`\nRencana: ${resolved.length} cocok, ${unresolved.length} bermasalah`);

  if (unresolved.length > 0) {
    console.log("\nENTRI YANG PERLU DIPERBAIKI:");
    for (const item of unresolved) {
      const label = item.entry.db_name
        ? `"${item.entry.name}" (db: "${item.entry.db_name}")`
        : `"${item.entry.name ?? item.entry.nis}"`;
      if (item.reason === "AMBIGUOUS") {
        const names = (item.candidates ?? [])
          .map((member) => `${member.full_name} (${member.class_grade ?? "-"}, ${member.organization_type})`)
          .join(" | ");
        console.log(`  - Baris ${item.index}: ${label} -> AMBIGU ${names}`);
      } else {
        console.log(`  - Baris ${item.index}: ${label} -> ${item.reason}`);
      }
    }
  }

  if (replaceRoster && unresolved.length > 0) {
    console.error("\n[ABORT] --replace dibatalkan karena masih ada entri tidak cocok.");
    console.error("Perbaiki file roster lalu jalankan ulang. Database belum diubah.");
    process.exit(1);
  }

  const scheduleIdsInFile = [
    ...new Set(
      resolved
        .map((item) => scheduleMap.get(`${item.entry.week}:${item.entry.day}`))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  // 5. Eksekusi
  if (isDryRun) {
    for (const item of resolved) {
      console.log(`[DRY RUN] ${item.member!.full_name} -> ${item.entry.week} ${item.entry.day}`);
    }
    console.log("\n[DRY RUN] Tidak ada perubahan yang disimpan.");
    await prisma.$disconnect();
    return;
  }

  if (replaceRoster) {
    const removed = await prisma.dutyRosterMember.deleteMany({
      where: { duty_schedule_id: { in: scheduleIdsInFile } },
    });
    console.log(
      `[REPLACE] ${removed.count} penugasan lama dihapus dari ${scheduleIdsInFile.length} jadwal.`
    );
  }

  let inserted = 0;
  let duplicate = 0;
  for (const item of resolved) {
    const scheduleId = scheduleMap.get(`${item.entry.week}:${item.entry.day}`);
    if (!scheduleId) continue;
    try {
      await prisma.dutyRosterMember.upsert({
        where: {
          duty_schedule_id_member_id: {
            duty_schedule_id: scheduleId,
            member_id: item.member!.id,
          },
        },
        create: { duty_schedule_id: scheduleId, member_id: item.member!.id },
        update: {},
      });
      inserted++;
      console.log(`[OK] ${item.member!.full_name} -> ${item.entry.week} ${item.entry.day}`);
    } catch {
      duplicate++;
      console.warn(
        `[SKIP] ${item.member!.full_name} sudah ada di ${item.entry.week} ${item.entry.day}`
      );
    }
  }

  console.log("");
  console.log("=".repeat(64));
  console.log("  LAPORAN HASIL IMPORT");
  console.log("=".repeat(64));
  console.log(`Total entri file     : ${entries.length}`);
  console.log(`Format tidak valid   : ${entries.length - validEntries.length}`);
  console.log(`Anggota tidak cocok  : ${unresolved.length}`);
  console.log(`Berhasil disimpan    : ${inserted}`);
  console.log(`Duplikat dilewati    : ${duplicate}`);
  console.log(`Jadwal dibuat        : ${createSchedules ? missingCombos.length : 0}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Error tidak terduga:", err);
  await prisma.$disconnect();
  process.exit(1);
});
