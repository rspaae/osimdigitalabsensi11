/**
 * import-sapa-pagi-roster.ts
 *
 * Script aman untuk mengimpor roster Sapa Pagi (dan/atau Danusan)
 * dari file JSON ke database melalui DutyRosterMember.
 *
 * PENGGUNAAN:
 *   npx ts-node --project tsconfig.json -e "require('./scripts/import-sapa-pagi-roster.ts')"
 * atau:
 *   npx tsx scripts/import-sapa-pagi-roster.ts --input roster-data.json --dry-run
 *
 * OPSI:
 *   --input <path>   Path file JSON roster (default: scripts/roster-data.json)
 *   --dry-run        Simulasi import tanpa menyimpan ke database
 *   --activity <code> Kode aktivitas (default: SAPA_PAGI)
 *
 * FORMAT FILE JSON:
 * [
 *   { "nis": "123456", "name": "Nama Lengkap", "week": "WEEK_1", "day": "MONDAY" },
 *   ...
 * ]
 *
 * - Bidang "nis" atau "name" digunakan untuk mencocokkan anggota (NIS lebih diprioritaskan).
 * - Pencocokan berdasarkan NIS bersifat EXACT. Pencocokan berdasarkan nama juga EXACT (case-insensitive).
 * - Script TIDAK membuat anggota baru, TIDAK menebak identitas, dan TIDAK mengisi data dummy.
 * - Script bersifat idempoten: entri duplikat pada DutyRosterMember dilewati (upsert by constraint).
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

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

// ─── Tipe Data Input ─────────────────────────────────────────────────────────

interface RosterEntry {
  nis?: string;
  name?: string;
  week: "WEEK_1" | "WEEK_2";
  day:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
}

// ─── Validasi Format ─────────────────────────────────────────────────────────

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

function validateEntry(
  entry: unknown,
  index: number
): entry is RosterEntry {
  if (typeof entry !== "object" || entry === null) {
    console.error(`[SKIP] Baris ${index}: bukan objek JSON.`);
    return false;
  }
  const e = entry as Record<string, unknown>;
  if (!e.nis && !e.name) {
    console.error(
      `[SKIP] Baris ${index}: tidak memiliki field "nis" atau "name".`
    );
    return false;
  }
  if (!VALID_WEEKS.has(String(e.week))) {
    console.error(`[SKIP] Baris ${index}: nilai "week" tidak valid ("${e.week}"). Gunakan WEEK_1 atau WEEK_2.`);
    return false;
  }
  if (!VALID_DAYS.has(String(e.day))) {
    console.error(`[SKIP] Baris ${index}: nilai "day" tidak valid ("${e.day}"). Gunakan MONDAY-SUNDAY.`);
    return false;
  }
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  IMPORT ROSTER SAPA PAGI / DANUSAN");
  console.log("=".repeat(60));
  console.log(`Input  : ${inputPath}`);
  console.log(`Aktivitas: ${activityCode}`);
  console.log(`Mode   : ${isDryRun ? "DRY RUN (tidak ada perubahan tersimpan)" : "LIVE"}`);
  console.log("");

  // 1. Baca file input
  if (!fs.existsSync(inputPath!)) {
    console.error(`File input tidak ditemukan: ${inputPath}`);
    console.error(
      "Buat file JSON dengan format yang didokumentasikan di scripts/roster-data.json.example"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath!, "utf-8");
  let entries: unknown[];
  try {
    entries = JSON.parse(raw);
  } catch {
    console.error("File JSON tidak valid.");
    process.exit(1);
  }

  if (!Array.isArray(entries)) {
    console.error("File JSON harus berupa array.");
    process.exit(1);
  }

  console.log(`Total entri di file: ${entries.length}`);
  console.log("");

  // 2. Cari aktivitas
  const activity = await prisma.activity.findFirst({
    where: { code: activityCode },
  });

  if (!activity) {
    console.error(
      `Aktivitas dengan kode "${activityCode}" tidak ditemukan di database.`
    );
    console.error(
      "Buat aktivitas terlebih dahulu melalui API atau Prisma Studio."
    );
    process.exit(1);
  }

  console.log(`✅ Aktivitas ditemukan: ${activity.name} (ID: ${activity.id})`);

  // 3. Muat semua DutySchedule untuk aktivitas ini
  const dutySchedules = await prisma.dutySchedule.findMany({
    where: { activity_id: activity.id, is_active: true },
    select: { id: true, cycle_week: true, day_of_week: true, title: true },
  });

  if (dutySchedules.length === 0) {
    console.error(
      "Tidak ada DutySchedule aktif ditemukan untuk aktivitas ini."
    );
    console.error(
      "Buat DutySchedule (Minggu 1 & 2, Senin–Jumat) melalui API duty/schedules terlebih dahulu."
    );
    process.exit(1);
  }

  console.log(`✅ DutySchedule aktif ditemukan: ${dutySchedules.length} jadwal`);

  const scheduleMap = new Map<string, string>();
  for (const s of dutySchedules) {
    scheduleMap.set(`${s.cycle_week}:${s.day_of_week}`, s.id);
  }

  // 4. Proses setiap entri
  const results = {
    matched: 0,
    inserted: 0,
    skipped_duplicate: 0,
    skipped_no_schedule: 0,
    skipped_invalid: 0,
    unmatched: [] as Array<{ index: number; nis?: string; name?: string }>,
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (!validateEntry(entry, i + 1)) {
      results.skipped_invalid++;
      continue;
    }

    const e = entry as RosterEntry;

    // 5. Cari anggota berdasarkan NIS (prioritas utama) atau nama (fallback)
    let member: { id: string; full_name: string; nis: string | null } | null = null;

    if (e.nis) {
      member = await prisma.member.findUnique({
        where: { nis: e.nis },
        select: { id: true, full_name: true, nis: true },
      });
    }

    if (!member && e.name) {
      member = await prisma.member.findFirst({
        where: {
          full_name: { equals: e.name, mode: "insensitive" },
        },
        select: { id: true, full_name: true, nis: true },
      });
    }

    if (!member) {
      console.warn(
        `[UNMATCHED] Baris ${i + 1}: NIS="${e.nis ?? "-"}" Name="${e.name ?? "-"}" tidak ditemukan di database.`
      );
      results.unmatched.push({ index: i + 1, nis: e.nis, name: e.name });
      continue;
    }

    results.matched++;

    // 6. Cari DutySchedule yang sesuai
    const scheduleId = scheduleMap.get(`${e.week}:${e.day}`);
    if (!scheduleId) {
      console.warn(
        `[NO_SCHEDULE] Baris ${i + 1} (${member.full_name}): DutySchedule ${e.week}/${e.day} tidak ditemukan.`
      );
      results.skipped_no_schedule++;
      continue;
    }

    // 7. Upsert DutyRosterMember (idempoten)
    if (isDryRun) {
      console.log(
        `[DRY RUN] Baris ${i + 1}: Akan insert ${member.full_name} → ${e.week} ${e.day}`
      );
      results.inserted++;
      continue;
    }

    try {
      await prisma.dutyRosterMember.upsert({
        where: {
          duty_schedule_id_member_id: {
            duty_schedule_id: scheduleId,
            member_id: member.id,
          },
        },
        create: {
          duty_schedule_id: scheduleId,
          member_id: member.id,
        },
        update: {}, // Tidak ada perubahan jika sudah ada
      });
      console.log(
        `[INSERT] Baris ${i + 1}: ${member.full_name} (NIS: ${member.nis}) → ${e.week} ${e.day}`
      );
      results.inserted++;
    } catch {
      console.warn(
        `[SKIP] Baris ${i + 1}: ${member.full_name} sudah ada di roster ${e.week} ${e.day}.`
      );
      results.skipped_duplicate++;
    }
  }

  // 8. Laporan
  console.log("");
  console.log("=".repeat(60));
  console.log("  LAPORAN HASIL IMPORT");
  console.log("=".repeat(60));
  console.log(`Total entri diproses : ${entries.length}`);
  console.log(`Anggota ditemukan    : ${results.matched}`);
  console.log(
    `Berhasil diinsert    : ${results.inserted}${isDryRun ? " (simulasi)" : ""}`
  );
  console.log(`Duplikat dilewati    : ${results.skipped_duplicate}`);
  console.log(`Jadwal tidak ada     : ${results.skipped_no_schedule}`);
  console.log(`Format tidak valid   : ${results.skipped_invalid}`);
  console.log(`Anggota tidak cocok  : ${results.unmatched.length}`);

  if (results.unmatched.length > 0) {
    console.log("");
    console.log("DAFTAR ANGGOTA TIDAK DITEMUKAN:");
    for (const u of results.unmatched) {
      console.log(
        `  - Baris ${u.index}: NIS="${u.nis ?? "-"}" Name="${u.name ?? "-"}"`
      );
    }
    console.log(
      "\nSilakan verifikasi NIS / nama dengan data di database terlebih dahulu."
    );
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] Tidak ada perubahan yang disimpan.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error tidak terduga:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
