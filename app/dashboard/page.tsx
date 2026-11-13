import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { AppModule, PermissionAction } from "@/types/auth";
import { getCycleStatus } from "@/lib/services/duty.service";
import {
  applyCycleWeekOffset,
  getActivityWeekOffsets,
  weekLabel,
} from "@/lib/services/activity-week.service";
import { prisma } from "@/lib/db/prisma";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import LiveRefresh from "./LiveRefresh";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_ORDER,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/utils/attendance-status";

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

const WEEKDAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

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

interface TaskRowProps {
  tone: "is-lav" | "is-mint" | "is-cream" | "is-pink";
  title: string;
  detail: string;
  href?: string;
  children: ReactNode;
}

/** Satu baris daftar kesiapan; memakai tautan hanya bila pengguna boleh membuka halaman tujuan. */
function TaskRow({ tone, title, detail, href, children }: TaskRowProps) {
  const body = (
    <>
      <span className={`dh-task-icon ${tone}`} aria-hidden="true">{children}</span>
      <span className="dh-task-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      {href ? <span className="dh-task-arrow" aria-hidden="true">›</span> : null}
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="dh-task">{body}</Link>
      ) : (
        <div className="dh-task">{body}</div>
      )}
    </li>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canCorrect = canAccessModule(
    user,
    AppModule.HISTORY_CORRECTION,
    PermissionAction.CORRECT
  );
  const canManage = user.role === "SUPERADMIN";

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

  const [weekOffsets, dutySchedules, substitutions, attendances, activeMembers, membersWithRfid, activeDevices] =
    await Promise.all([
      getActivityWeekOffsets(),
      prisma.dutySchedule.findMany({
        where: {
          is_active: true,
          ...(cycleWeek
            ? { day_of_week: wib.dayOfWeek }
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

  // Minggu efektif per kegiatan: kegiatan dengan offset (mis. Danusan) bisa
  // memakai minggu kebalikan dari siklus global pada hari yang sama.
  const effectiveDutySchedules = cycleWeek
    ? dutySchedules.filter(
        (schedule) =>
          applyCycleWeekOffset(
            cycleWeek,
            weekOffsets.get(schedule.activity.code.toUpperCase()) ?? 0
          ) === schedule.cycle_week
      )
    : [];

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

  const dutyCards = effectiveDutySchedules.map((duty) => {
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
      const orderA = a.attendance
        ? (ATTENDANCE_STATUS_ORDER[a.attendance.status] ?? 5)
        : 6;
      const orderB = b.attendance
        ? (ATTENDANCE_STATUS_ORDER[b.attendance.status] ?? 5)
        : 6;
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
      weekLabel: weekLabel(duty.cycle_week),
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
    month: "long",
    year: "numeric",
  }).format(now);
  const cycleLabel = cycleWeek
    ? cycleWeek === "WEEK_1"
      ? "Minggu ke-1"
      : "Minggu ke-2"
    : "Siklus belum aktif";
  const attendancePercent =
    petugasIds.size === 0
      ? 0
      : Math.round((petugasAbsenIds.size / petugasIds.size) * 100);

  // Kalender bulan berjalan menurut WIB; Senin sebagai kolom pertama.
  const [wibYear, wibMonth, wibDay] = wib.dateStr.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(wibYear, wibMonth - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(wibYear, wibMonth, 0)).getUTCDate();
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const dayLabel = DAY_LABEL[wib.dayOfWeek] ?? wib.dayOfWeek;

  return (
    <main className="dh-root">
      <section className="dh-hero" aria-labelledby="home-hero-title">
        <div className="dh-hero-copy">
          <span className="dh-hero-date">{dateLabel}</span>
          <h1 id="home-hero-title">Selamat datang, {user.username}!</h1>
          <p className="dh-hero-sub">
            {cycleLabel} · {numberFormat.format(dutyCards.length)} kegiatan piket hari ini ·{" "}
            {numberFormat.format(petugasAbsenIds.size)} dari{" "}
            {numberFormat.format(petugasIds.size)} petugas sudah absen.
          </p>

          <div className="dh-hero-meta">
            <span className="dh-hero-chip">{dayLabel}</span>
            <span className="dh-hero-chip">{wib.timeStr} WIB</span>
            <span className="dh-hero-chip">
              {numberFormat.format(attendances.length)} scan masuk
            </span>
          </div>

          <div className="dh-hero-progress">
            <div className="dh-hero-progress-copy">
              <span>
                {petugasIds.size === 0
                  ? "Belum ada petugas terjadwal hari ini"
                  : "Progres absensi petugas"}
              </span>
              <strong>{attendancePercent}%</strong>
            </div>
            <div
              className="dh-hero-track"
              role="progressbar"
              aria-label="Progres absensi petugas hari ini"
              aria-valuenow={attendancePercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${attendancePercent}%` }} />
            </div>
          </div>
        </div>

        <div className="dh-hero-art" aria-hidden="true">
          <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="152" cy="30" r="24" fill="rgba(255,255,255,0.14)" />
            <circle cx="44" cy="122" r="16" fill="rgba(255,255,255,0.1)" />
            <rect x="30" y="36" width="104" height="70" rx="14" transform="rotate(-7 30 36)" fill="rgba(255,255,255,0.94)" />
            <rect x="40" y="48" width="46" height="6" rx="3" transform="rotate(-7 40 48)" fill="#c9d8f6" />
            <circle cx="52" cy="74" r="10" fill="#e9f0ff" />
            <path d="M47.8 74.4l3 3 5.2-5.6" stroke="#2f6bff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="70" y="68" width="52" height="6" rx="3" transform="rotate(-7 70 68)" fill="#dbe5fa" />
            <rect x="70" y="80" width="36" height="6" rx="3" transform="rotate(-7 70 80)" fill="#e6eefb" />
            <rect x="116" y="86" width="58" height="38" rx="9" transform="rotate(8 116 86)" fill="rgba(255,255,255,0.9)" />
            <rect x="126" y="96" width="18" height="13" rx="3" transform="rotate(8 126 96)" fill="#2f6bff" opacity="0.75" />
            <path d="M152 98h6M151 105h10" stroke="#b9cdf2" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      {canManage && !cycleStatus?.configured && (
        <section className="dh-notice" role="alert">
          <span className="dh-notice-mark" aria-hidden="true">!</span>
          <div>
            <strong>Siklus absensi belum dikonfigurasi</strong>
            <p>Atur tanggal awal siklus sebelum perangkat menerima scan RFID.</p>
          </div>
          <Link href="/dashboard/settings/cycle">Atur siklus</Link>
        </section>
      )}

      <section className="dh-metrics" aria-label="Ringkasan kehadiran hari ini">
        <article className="dh-metric is-lav">
          <div className="dh-metric-top">
            <span className="dh-metric-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>
            </span>
            <span className="dh-metric-label">Petugas hari ini</span>
          </div>
          <strong className="dh-metric-value">{numberFormat.format(petugasIds.size)}</strong>
          <span className="dh-metric-note">
            {numberFormat.format(dutyCards.length)} kegiatan piket
          </span>
        </article>

        <article className="dh-metric is-mint">
          <div className="dh-metric-top">
            <span className="dh-metric-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m9 11 3 3L22 4" /></svg>
            </span>
            <span className="dh-metric-label">Sudah absen</span>
          </div>
          <strong className="dh-metric-value">
            {numberFormat.format(petugasAbsenIds.size)}
            <small> / {numberFormat.format(petugasIds.size)}</small>
          </strong>
          <span className="dh-metric-note">
            {numberFormat.format(petugasHadirIds.size)} hadir tepat waktu
          </span>
        </article>

        <article className="dh-metric is-pink">
          <div className="dh-metric-top">
            <span className="dh-metric-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </span>
            <span className="dh-metric-label">Belum absen</span>
          </div>
          <strong className="dh-metric-value">{numberFormat.format(belumAbsen)}</strong>
          <span className="dh-metric-note">
            {belumAbsen === 0
              ? "Semua petugas sudah tercatat"
              : "Belum ada rekaman scan sampai sekarang"}
          </span>
        </article>

        <article className="dh-metric is-cream">
          <div className="dh-metric-top">
            <span className="dh-metric-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="3" /><path d="M2 11h20M6.5 15h4" /></svg>
            </span>
            <span className="dh-metric-label">Scan masuk</span>
          </div>
          <strong className="dh-metric-value">{numberFormat.format(attendances.length)}</strong>
          <span className="dh-metric-note">termasuk anggota non-petugas</span>
        </article>
      </section>

      <div className="dh-grid">
        <div className="dh-col">
          <section className="dh-panel" aria-labelledby="home-schedule-title">
            <header className="dh-panel-head">
              <div>
                <p className="dh-panel-eyebrow">JADWAL PIKET</p>
                <h2 className="dh-panel-title" id="home-schedule-title">Hari ini</h2>
              </div>
              <div className="dh-panel-note">
                <LiveRefresh />
              </div>
            </header>

            {dutyCards.length === 0 ? (
              <div className="dh-empty">
                <strong>Tidak ada jadwal piket hari ini</strong>
                <span>
                  {cycleStatus?.configured
                    ? "Belum ada jadwal aktif untuk hari ini. Scan yang masuk tetap dicatat sebagai “Di luar jam”."
                    : "Atur tanggal mulai siklus lebih dulu agar jadwal piket bisa ditentukan."}
                </span>
                {canManage && !cycleStatus?.configured && (
                  <Link href="/dashboard/settings/cycle" className="dh-empty-link">
                    Atur siklus →
                  </Link>
                )}
              </div>
            ) : (
              <div className="dh-duty-list">
                {dutyCards.map((duty) => (
                  <article className={`dh-duty is-${duty.state}`} key={duty.id}>
                    <div className="dh-duty-top">
                      <div>
                        <h3 className="dh-duty-name">{duty.activityName}</h3>
                        <p className="dh-duty-time">
                          {duty.startTime}–{duty.cutoffTime} WIB · {duty.weekLabel}
                        </p>
                      </div>
                      <span className="dh-duty-badge">
                        {duty.state === "live"
                          ? "Berlangsung"
                          : duty.state === "soon"
                            ? "Belum mulai"
                            : "Selesai"}
                      </span>
                    </div>

                    <div className="dh-duty-progress">
                      <div className="dh-duty-progress-copy">
                        <span>
                          {duty.scannedCount} dari {duty.total} petugas sudah absen
                        </span>
                        <strong>{duty.percentage}%</strong>
                      </div>
                      <div
                        className="dh-duty-track"
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
                      <p className="dh-empty-small">Belum ada petugas terjadwal.</p>
                    ) : (
                      <ul className="dh-duty-roster">
                        {duty.rows.map((row) => (
                          <li key={`${duty.id}-${row.member.id}`}>
                            <span className="dh-avatar" aria-hidden="true">
                              {initials(row.member.full_name)}
                            </span>
                            <span className="dh-person">
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
                                className={`dh-status is-${
                                  ATTENDANCE_STATUS_STYLE[row.attendance.status] ?? "belum"
                                }`}
                              >
                                {ATTENDANCE_STATUS_LABEL[row.attendance.status] ??
                                  row.attendance.status}
                              </span>
                            ) : (
                              <span className="dh-status is-belum">Belum scan</span>
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

          <section className="dh-panel" aria-labelledby="home-history-title">
            <header className="dh-panel-head">
              <div>
                <p className="dh-panel-eyebrow">RIWAYAT SCAN</p>
                <h2 className="dh-panel-title" id="home-history-title">Scan masuk hari ini</h2>
              </div>
              <Link href="/dashboard/attendance" className="dh-panel-link">
                Lihat rekap →
              </Link>
            </header>

            {attendances.length === 0 ? (
              <div className="dh-empty">
                <strong>Belum ada scan masuk hari ini</strong>
                <span>{dateLabel} — riwayat akan muncul otomatis saat kartu ditempel.</span>
              </div>
            ) : (
              <div className="dh-table-wrap">
                <table className="dh-table table-stack" aria-label="Riwayat scan hari ini">
                  <thead>
                    <tr>
                      <th scope="col">Waktu</th>
                      <th scope="col">Nama</th>
                      <th scope="col">Kegiatan</th>
                      <th scope="col" className="dh-col-method">Metode</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.map((record) => {
                      const scanWib = getWibDateComponents(record.scan_time);
                      return (
                        <tr key={record.id}>
                          <td data-label="Waktu">
                            <time dateTime={record.scan_time.toISOString()}>
                              {scanWib.timeWithSecondsStr}
                            </time>
                            {record.scan_count > 1 && (
                              <small
                                title={`Tap terakhir: ${getWibDateComponents(record.last_scan_at).timeWithSecondsStr} WIB`}
                              >
                                {record.scan_count}× tap
                              </small>
                            )}
                          </td>
                          <td data-label="Nama">
                            <strong>{record.member.full_name}</strong>
                            <small>{personMeta(record.member)}</small>
                          </td>
                          <td data-label="Kegiatan">{record.schedule.activity.name}</td>
                          <td data-label="Metode" className="dh-col-method">{record.method === "RFID" ? "RFID" : "Manual"}</td>
                          <td data-label="Status">
                            <span className="dh-table-actions">
                              <span
                                className={`dh-status is-${
                                  ATTENDANCE_STATUS_STYLE[record.status] ?? "belum"
                                }`}
                              >
                                {ATTENDANCE_STATUS_LABEL[record.status] ?? record.status}
                              </span>
                              {canCorrect && (
                                <Link
                                  href={`/dashboard/attendance/${record.id}`}
                                  className="dh-row-link"
                                >
                                  Koreksi
                                </Link>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="dh-footnote">
              Status “Di luar jam” berarti kartu ditempel di luar jendela piket. Koreksi status
              dilakukan pengurus melalui rekap presensi.
            </p>
          </section>
        </div>

        <aside className="dh-col">
          <section className="dh-panel" aria-labelledby="home-calendar-title">
            <header className="dh-panel-head">
              <div>
                <p className="dh-panel-eyebrow">KALENDER</p>
                <h2 className="dh-panel-title" id="home-calendar-title">Jadwal bulan ini</h2>
              </div>
              <span className="dh-panel-note">{cycleLabel}</span>
            </header>

            <div className="dh-cal-head">
              <span className="dh-cal-month">{monthLabel}</span>
              <span className="dh-cal-sub">{numberFormat.format(dutyCards.length)} piket hari ini</span>
            </div>

            <div className="dh-cal" aria-label={`Kalender ${monthLabel}, hari ini tanggal ${wibDay}`}>
              {WEEKDAY_SHORT.map((day) => (
                <span key={day} className="dh-cal-dow">{day}</span>
              ))}
              {calendarCells.map((day, index) =>
                day === null ? (
                  <span key={`blank-${index}`} className="dh-cal-day is-empty" aria-hidden="true" />
                ) : (
                  <span
                    key={`day-${day}`}
                    className={`dh-cal-day${day === wibDay ? " is-today" : ""}`}
                    aria-current={day === wibDay ? "date" : undefined}
                  >
                    {day}
                  </span>
                )
              )}
            </div>
          </section>

          <section className="dh-panel" aria-labelledby="home-system-title">
            <header className="dh-panel-head">
              <div>
                <p className="dh-panel-eyebrow">STATUS SISTEM</p>
                <h2 className="dh-panel-title" id="home-system-title">Kesiapan</h2>
              </div>
              <span className={`home-pill ${scanReady ? "is-ok" : "is-warn"}`}>
                {scanReady ? "Siap" : "Perlu persiapan"}
              </span>
            </header>

            <ul className="dh-task-list">
              <TaskRow
                tone="is-mint"
                title={`${numberFormat.format(membersWithRfid)}/${numberFormat.format(activeMembers)} anggota punya UID`}
                detail={`Cakupan kartu RFID ${rfidCoverage}%`}
                href={canManage ? "/dashboard/members" : undefined}
              >
                <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></svg>
              </TaskRow>

              <TaskRow
                tone={activeDevices > 0 ? "is-lav" : "is-pink"}
                title={
                  activeDevices > 0
                    ? `${numberFormat.format(activeDevices)} perangkat aktif`
                    : "Perangkat belum terdaftar"
                }
                detail="ESP32 + pembaca RC522"
                href={canManage ? "/dashboard/devices" : undefined}
              >
                <svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v4m4-4v4m-4 10v4m4-4v4M3 10h4m-4 4h4m10-4h4m-4 4h4" /></svg>
              </TaskRow>

              <TaskRow
                tone={cycleStatus?.configured ? "is-cream" : "is-pink"}
                title={
                  cycleStatus?.configured
                    ? `Siklus mulai ${cycleStatus.cycle_start_date}`
                    : "Tanggal siklus belum diatur"
                }
                detail={cycleLabel}
                href={canManage ? "/dashboard/settings/cycle" : undefined}
              >
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </TaskRow>

              <TaskRow
                tone="is-lav"
                title={`${numberFormat.format(dutyCards.length)} jadwal piket hari ini`}
                detail={`Hari ${dayLabel} · ${wib.timeStr} WIB`}
                href={canManage ? "/dashboard/duty/sapa-pagi" : undefined}
              >
                <svg viewBox="0 0 24 24"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2m3 10h3m-3 4h7" /></svg>
              </TaskRow>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
