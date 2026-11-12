import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/context";
import { getCycleStatus } from "@/lib/services/duty.service";
import { prisma } from "@/lib/db/prisma";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";

export const instant = false;

export const metadata: Metadata = {
  title: "Ringkasan | OSIS MPK SMKN 11 BANDUNG",
};

const numberFormat = new Intl.NumberFormat("id-ID");

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

const ORG_LABEL: Record<string, string> = {
  OSIS: "OSIS",
  MPK: "MPK",
  GENERAL: "Umum",
};

const STATUS_LABEL: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  ALPA: "Alpa",
  DI_LUAR_JADWAL: "Di luar jam",
};

const STATUS_STYLE: Record<string, string> = {
  HADIR: "hadir",
  TERLAMBAT: "terlambat",
  IZIN: "izin",
  SAKIT: "sakit",
  ALPA: "alpa",
  DI_LUAR_JADWAL: "luar",
};

/** Urutan tampil: yang sudah tercatat lebih dulu, yang belum scan di bawah. */
const STATUS_ORDER: Record<string, number> = {
  HADIR: 0,
  DI_LUAR_JADWAL: 1,
  IZIN: 2,
  SAKIT: 2,
  TERLAMBAT: 3,
  ALPA: 4,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

function personMeta(member: {
  class_grade: string | null;
  organization_type: string;
}): string {
  const org = ORG_LABEL[member.organization_type] ?? member.organization_type;
  return member.class_grade ? `${member.class_grade} · ${org}` : org;
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const now = new Date();
  const wib = getWibDateComponents(now);
  const startOfDayUtc = new Date(`${wib.dateStr}T00:00:00+07:00`);
  const endOfDayUtc = new Date(`${wib.dateStr}T23:59:59.999+07:00`);
  const todayDateUtc = parseDateOnlyToUtc(wib.dateStr);

  const cycleStatus = await getCycleStatus(now).catch(() => null);
  const cycleWeek =
    cycleStatus?.configured && "cycle_week" in cycleStatus
      ? cycleStatus.cycle_week
      : null;

  const [dutySchedules, substitutions, attendances, activeMembers, membersWithRfid, activeDevices] =
    await Promise.all([
      prisma.dutySchedule.findMany({
        where: {
          is_active: true,
          ...(cycleWeek
            ? { cycle_week: cycleWeek, day_of_week: wib.dayOfWeek }
            : { id: { in: [] } }),
        },
        include: {
          activity: { select: { id: true, name: true, code: true } },
          roster_members: {
            include: {
              member: {
                select: {
                  id: true,
                  full_name: true,
                  class_grade: true,
                  organization_type: true,
                },
              },
            },
          },
        },
        orderBy: { start_time_wib: "asc" },
      }),
      prisma.dutySubstitution.findMany({
        where: { duty_date: todayDateUtc, status: "APPROVED" },
        include: {
          substitute_member: {
            select: {
              id: true,
              full_name: true,
              class_grade: true,
              organization_type: true,
            },
          },
          original_member: { select: { full_name: true } },
        },
      }),
      prisma.attendance.findMany({
        where: { scan_time: { gte: startOfDayUtc, lte: endOfDayUtc } },
        include: {
          member: {
            select: {
              id: true,
              full_name: true,
              class_grade: true,
              organization_type: true,
            },
          },
          schedule: { select: { activity: { select: { name: true } } } },
        },
        orderBy: { scan_time: "desc" },
      }),
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.member.count({ where: { status: "ACTIVE", rfid_uid: { not: null } } }),
      prisma.device.count({ where: { is_active: true } }),
    ]);

  // Absensi per (jadwal piket, anggota) untuk menentukan status tiap petugas.
  const attendanceByDutyMember = new Map<
    string,
    (typeof attendances)[number]
  >();
  for (const record of attendances) {
    if (record.duty_schedule_id) {
      attendanceByDutyMember.set(
        `${record.duty_schedule_id}:${record.member_id}`,
        record
      );
    }
  }

  const dutyCards = dutySchedules.map((duty) => {
    const rows = duty.roster_members.map((entry) => ({
      member: entry.member,
      isSubstitution: false,
      replaces: null as string | null,
      attendance:
        attendanceByDutyMember.get(`${duty.id}:${entry.member.id}`) ?? null,
    }));

    for (const substitution of substitutions) {
      if (substitution.duty_schedule_id !== duty.id) continue;
      if (rows.some((row) => row.member.id === substitution.substitute_member.id)) {
        continue;
      }
      rows.push({
        member: substitution.substitute_member,
        isSubstitution: true,
        replaces: substitution.original_member.full_name,
        attendance:
          attendanceByDutyMember.get(
            `${duty.id}:${substitution.substitute_member.id}`
          ) ?? null,
      });
    }

    rows.sort((a, b) => {
      const orderA = a.attendance ? (STATUS_ORDER[a.attendance.status] ?? 5) : 6;
      const orderB = b.attendance ? (STATUS_ORDER[b.attendance.status] ?? 5) : 6;
      if (orderA !== orderB) return orderA - orderB;
      return a.member.full_name.localeCompare(b.member.full_name, "id");
    });

    const scannedCount = rows.filter((row) => row.attendance !== null).length;
    const hadirCount = rows.filter(
      (row) => row.attendance?.status === "HADIR"
    ).length;
    const state =
      wib.timeStr < duty.start_time_wib
        ? "soon"
        : wib.timeStr <= duty.cutoff_time_wib
          ? "live"
          : "done";

    return {
      id: duty.id,
      activityName: duty.activity.name,
      startTime: duty.start_time_wib,
      cutoffTime: duty.cutoff_time_wib,
      state,
      rows,
      scannedCount,
      hadirCount,
      total: rows.length,
      percentage: rows.length === 0 ? 0 : Math.round((scannedCount / rows.length) * 100),
    };
  });

  // Statistik tingkat anggota (satu orang dihitung sekali walau ikut dua kegiatan).
  const petugasIds = new Set<string>();
  const petugasAbsenIds = new Set<string>();
  const petugasHadirIds = new Set<string>();
  for (const duty of dutyCards) {
    for (const row of duty.rows) {
      petugasIds.add(row.member.id);
      if (row.attendance) petugasAbsenIds.add(row.member.id);
      if (row.attendance?.status === "HADIR") petugasHadirIds.add(row.member.id);
    }
  }
  const belumAbsen = Math.max(0, petugasIds.size - petugasAbsenIds.size);
  const rfidCoverage =
    activeMembers === 0 ? 0 : Math.round((membersWithRfid / activeMembers) * 100);
  const needsRfid = Math.max(0, activeMembers - membersWithRfid);
  const scanReady =
    needsRfid === 0 &&
    activeDevices > 0 &&
    cycleStatus?.configured === true &&
    dutyCards.length > 0;

  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "short",
    year: "numeric",
  }).format(now);
  const dayNumber = String(Number(wib.dateStr.slice(8, 10)));
  const cycleLabel = cycleWeek
    ? cycleWeek === "WEEK_1"
      ? "Minggu ke-1"
      : "Minggu ke-2"
    : "Siklus belum aktif";

  return (
    <main className="overview-home">
      <header className="home-head">
        <div>
          <p className="home-eyebrow">RINGKASAN HARI INI</p>
          <h1>Halo, {user.username}</h1>
          <p className="home-subtitle">
            {dateLabel} · {cycleLabel} · {numberFormat.format(dutyCards.length)} kegiatan piket
          </p>
        </div>
        <div className="home-date-chip" aria-label={dateLabel}>
          <span className="home-date-day">{dayNumber}</span>
          <span className="home-date-rest">{monthLabel}</span>
        </div>
      </header>

      {user.role === "SUPERADMIN" && !cycleStatus?.configured && (
        <section className="overview-alert" role="alert">
          <span className="overview-alert-mark" aria-hidden="true">!</span>
          <div>
            <strong>Siklus absensi belum dikonfigurasi</strong>
            <p>Atur tanggal awal siklus sebelum perangkat menerima scan RFID.</p>
          </div>
          <Link href="/dashboard/settings/cycle" className="overview-alert-link">Atur siklus</Link>
        </section>
      )}

      <section className="home-stats" aria-label="Ringkasan kehadiran hari ini">
        <article className="home-stat">
          <span className="home-stat-label">Petugas hari ini</span>
          <strong>{numberFormat.format(petugasIds.size)}</strong>
          <span className="home-stat-note">
            {numberFormat.format(dutyCards.length)} kegiatan piket
          </span>
        </article>
        <article className="home-stat">
          <span className="home-stat-label">Sudah absen</span>
          <strong>
            {numberFormat.format(petugasAbsenIds.size)}
            <small> / {numberFormat.format(petugasIds.size)}</small>
          </strong>
          <span className="home-stat-note">
            {numberFormat.format(petugasHadirIds.size)} hadir tepat waktu
          </span>
        </article>
        <article className="home-stat">
          <span className="home-stat-label">Belum absen</span>
          <strong>{numberFormat.format(belumAbsen)}</strong>
          <span className="home-stat-note">
            {belumAbsen === 0
              ? "Semua petugas sudah tercatat"
              : "Belum ada rekaman scan sampai sekarang"}
          </span>
        </article>
        <article className="home-stat">
          <span className="home-stat-label">Scan masuk</span>
          <strong>{numberFormat.format(attendances.length)}</strong>
          <span className="home-stat-note">termasuk anggota non-petugas</span>
        </article>
      </section>

      <div className="home-grid">
        <section className="home-panel" aria-labelledby="home-schedule-title">
          <header className="home-panel-head">
            <div>
              <p className="home-eyebrow">JADWAL PIKET</p>
              <h2 id="home-schedule-title">Hari ini</h2>
            </div>
            <span className="home-panel-note">
              {DAY_LABEL[wib.dayOfWeek] ?? wib.dayOfWeek} · {cycleLabel} · {wib.timeStr} WIB
            </span>
          </header>

          {dutyCards.length === 0 ? (
            <div className="home-empty">
              <strong>Tidak ada jadwal piket hari ini</strong>
              <span>
                {cycleStatus?.configured
                  ? "Belum ada jadwal aktif untuk hari ini. Scan yang masuk tetap dicatat sebagai “Di luar jam”."
                  : "Atur tanggal mulai siklus lebih dulu agar jadwal piket bisa ditentukan."}
              </span>
              {user.role === "SUPERADMIN" && !cycleStatus?.configured && (
                <Link href="/dashboard/settings/cycle" className="home-link">
                  Atur siklus →
                </Link>
              )}
            </div>
          ) : (
            <div className="home-duty-grid">
              {dutyCards.map((duty) => (
                <article className="home-duty" key={duty.id}>
                  <header className="home-duty-head">
                    <div>
                      <h3>{duty.activityName}</h3>
                      <p>
                        {duty.startTime}–{duty.cutoffTime} WIB
                      </p>
                    </div>
                    <span className={`home-duty-state is-${duty.state}`}>
                      {duty.state === "live"
                        ? "Berlangsung"
                        : duty.state === "soon"
                          ? "Belum mulai"
                          : "Selesai"}
                    </span>
                  </header>

                  <div className="home-duty-progress">
                    <div className="home-duty-progress-copy">
                      <span>
                        {duty.scannedCount} dari {duty.total} petugas sudah absen
                      </span>
                      <strong>{duty.percentage}%</strong>
                    </div>
                    <div
                      className="home-duty-track"
                      role="progressbar"
                      aria-label={`Petugas ${duty.activityName} yang sudah absen`}
                      aria-valuenow={duty.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <i style={{ width: `${duty.percentage}%` }} />
                    </div>
                  </div>

                  {duty.rows.length === 0 ? (
                    <p className="home-empty-small">Belum ada petugas terjadwal.</p>
                  ) : (
                    <ul className="home-roster">
                      {duty.rows.map((row) => (
                        <li key={`${duty.id}-${row.member.id}`}>
                          <span className="home-avatar" aria-hidden="true">
                            {initials(row.member.full_name)}
                          </span>
                          <span className="home-person">
                            <strong>{row.member.full_name}</strong>
                            <small>
                              {personMeta(row.member)}
                              {row.isSubstitution && row.replaces
                                ? ` · Pengganti ${row.replaces}`
                                : ""}
                            </small>
                          </span>
                          {row.attendance ? (
                            <span
                              className={`home-status is-${
                                STATUS_STYLE[row.attendance.status] ?? "belum"
                              }`}
                            >
                              {STATUS_LABEL[row.attendance.status] ?? row.attendance.status}
                            </span>
                          ) : (
                            <span className="home-status is-belum">Belum scan</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="home-panel" aria-labelledby="home-system-title">
          <header className="home-panel-head">
            <div>
              <p className="home-eyebrow">STATUS SISTEM</p>
              <h2 id="home-system-title">Kesiapan</h2>
            </div>
            <span className={`home-pill ${scanReady ? "is-ok" : "is-warn"}`}>
              {scanReady ? "Siap" : "Perlu persiapan"}
            </span>
          </header>

          <ul className="home-check-list">
            <li>
              <span className={`home-check ${membersWithRfid > 0 ? "is-done" : ""}`}>
                {membersWithRfid > 0 ? "✓" : "–"}
              </span>
              <span>
                {numberFormat.format(membersWithRfid)} dari {numberFormat.format(activeMembers)} anggota
                punya UID kartu ({rfidCoverage}%)
              </span>
            </li>
            <li>
              <span className={`home-check ${activeDevices > 0 ? "is-done" : ""}`}>
                {activeDevices > 0 ? "✓" : "–"}
              </span>
              <span>
                {activeDevices > 0
                  ? `${numberFormat.format(activeDevices)} perangkat aktif`
                  : "Perangkat ESP32 belum didaftarkan"}
              </span>
            </li>
            <li>
              <span className={`home-check ${cycleStatus?.configured ? "is-done" : ""}`}>
                {cycleStatus?.configured ? "✓" : "–"}
              </span>
              <span>
                {cycleStatus?.configured
                  ? `Siklus dimulai ${cycleStatus.cycle_start_date}`
                  : "Tanggal mulai siklus belum diatur"}
              </span>
            </li>
            <li>
              <span className={`home-check ${dutyCards.length > 0 ? "is-done" : ""}`}>
                {dutyCards.length > 0 ? "✓" : "–"}
              </span>
              <span>
                {dutyCards.length > 0
                  ? `${numberFormat.format(dutyCards.length)} jadwal piket aktif hari ini`
                  : "Belum ada jadwal piket hari ini"}
              </span>
            </li>
          </ul>

          {user.role === "SUPERADMIN" && (
            <div className="home-actions">
              <Link href="/dashboard/members" className="overview-primary-action">Kelola UID anggota</Link>
              <Link href="/dashboard/devices" className="overview-secondary-action">Perangkat</Link>
              <Link href="/dashboard/duty/sapa-pagi" className="overview-secondary-action">Jadwal</Link>
            </div>
          )}
        </aside>
      </div>

      <section className="home-panel" aria-labelledby="home-history-title">
        <header className="home-panel-head">
          <div>
            <p className="home-eyebrow">RIWAYAT SCAN</p>
            <h2 id="home-history-title">Scan masuk hari ini</h2>
          </div>
          <Link href="/dashboard/attendance" className="home-link">
            Lihat rekap lengkap →
          </Link>
        </header>

        {attendances.length === 0 ? (
          <div className="home-empty">
            <strong>Belum ada scan masuk hari ini</strong>
            <span>{dateLabel} — riwayat akan muncul otomatis saat kartu ditempel.</span>
          </div>
        ) : (
          <div className="home-table-wrap">
            <table className="home-table" aria-label="Riwayat scan hari ini">
              <thead>
                <tr>
                  <th scope="col">Waktu</th>
                  <th scope="col">Nama</th>
                  <th scope="col">Kegiatan</th>
                  <th scope="col" className="home-col-method">Metode</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendances.map((record) => {
                  const scanWib = getWibDateComponents(record.scan_time);
                  return (
                    <tr key={record.id}>
                      <td>
                        <time dateTime={record.scan_time.toISOString()}>
                          {scanWib.timeWithSecondsStr}
                        </time>
                      </td>
                      <td>
                        <strong>{record.member.full_name}</strong>
                        <small>{personMeta(record.member)}</small>
                      </td>
                      <td>{record.schedule.activity.name}</td>
                      <td className="home-col-method">{record.method === "RFID" ? "RFID" : "Manual"}</td>
                      <td>
                        <span
                          className={`home-status is-${
                            STATUS_STYLE[record.status] ?? "belum"
                          }`}
                        >
                          {STATUS_LABEL[record.status] ?? record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="home-footnote">
          Status “Di luar jam” berarti kartu ditempel di luar jendela piket. Koreksi status dilakukan
          pengurus melalui rekap presensi.
        </p>
      </section>
    </main>
  );
}
