import { MemberStatus, ScheduleStatus, type OrganizationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { calculateRate } from "@/lib/utils/report-format";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import {
  REPORT_STATUS_COLUMNS,
  type ReportQuery,
  type ReportStatusKey,
} from "@/lib/validators/report.schema";

export const STATUS_LABEL: Record<ReportStatusKey, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  ALPA: "Alpa",
  DI_LUAR_JADWAL: "Di luar jam",
};

export const ORGANIZATION_LABEL: Record<OrganizationType, string> = {
  OSIS: "OSIS",
  MPK: "MPK",
  GENERAL: "Umum",
};

export interface ReportRow {
  memberId: string;
  name: string;
  nis: string | null;
  classGrade: string | null;
  organization: OrganizationType;
  position: string;
  counts: Record<ReportStatusKey, number>;
  recorded: number;
  unrecorded: number;
  /** Persentase (Hadir + Terlambat) / sesi. `null` bila periode tanpa sesi. */
  rate: number | null;
}

export interface ReportTotals extends Record<ReportStatusKey, number> {
  members: number;
  recorded: number;
  unrecorded: number;
}

export interface AttendanceReport {
  from: string;
  to: string;
  sessions: number;
  activityName: string | null;
  organization: OrganizationType | null;
  includeInactive: boolean;
  rows: ReportRow[];
  totals: ReportTotals;
  averageRate: number;
}

function emptyCounts(): Record<ReportStatusKey, number> {
  return {
    HADIR: 0,
    TERLAMBAT: 0,
    IZIN: 0,
    SAKIT: 0,
    ALPA: 0,
    DI_LUAR_JADWAL: 0,
  };
}

export function buildReportTotals(rows: ReportRow[]): ReportTotals {
  const totals: ReportTotals = {
    ...emptyCounts(),
    members: rows.length,
    recorded: 0,
    unrecorded: 0,
  };

  for (const row of rows) {
    for (const status of REPORT_STATUS_COLUMNS) {
      totals[status] += row.counts[status];
    }
    totals.recorded += row.recorded;
    totals.unrecorded += row.unrecorded;
  }

  return totals;
}

/**
 * Rekap kehadiran anggota untuk periode tertentu.
 *
 * Definisi:
 * - `sessions` = jumlah `ActivitySchedule` berstatus OPEN/CLOSED pada rentang tanggal.
 *   Sesi DRAFT tidak dihitung karena belum tentu benar-benar berlangsung.
 * - `recorded` = jumlah record absensi anggota pada sesi-sesi tersebut.
 * - `unrecorded` = sesi yang tidak memiliki record sama sekali (belum scan / belum direkonsiliasi).
 * - `rate` = (HADIR + TERLAMBAT) / sessions × 100 — sesi IZIN/SAKIT tidak dihitung hadir.
 */
export async function getAttendanceReport(query: ReportQuery): Promise<AttendanceReport> {
  const { dateStr: todayWib } = getWibDateComponents(new Date());
  const from = query.from ?? todayWib;
  const to = query.to ?? todayWib;
  const includeInactive = query.include_inactive === true;

  const rangeStart = parseDateOnlyToUtc(from);
  const rangeEnd = parseDateOnlyToUtc(to);

  const [members, activity, sessionRows] = await Promise.all([
    prisma.member.findMany({
      where: {
        ...(includeInactive
          ? { status: { in: [MemberStatus.ACTIVE, MemberStatus.INACTIVE] } }
          : { status: MemberStatus.ACTIVE }),
        ...(query.organization ? { organization_type: query.organization } : {}),
      },
      select: {
        id: true,
        full_name: true,
        nis: true,
        class_grade: true,
        organization_type: true,
        positions: {
          where: { is_active: true },
          select: { position: { select: { name: true, level: true } } },
          orderBy: { position: { level: "asc" } },
        },
      },
      orderBy: [{ class_grade: "asc" }, { full_name: "asc" }],
    }),
    query.activity_id
      ? prisma.activity.findUnique({
          where: { id: query.activity_id },
          select: { name: true },
        })
      : Promise.resolve(null),
    prisma.activitySchedule.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        status: { in: [ScheduleStatus.OPEN, ScheduleStatus.CLOSED] },
        ...(query.activity_id ? { activity_id: query.activity_id } : {}),
      },
      select: { id: true },
    }),
  ]);

  const sessions = sessionRows.length;
  const sessionIds = sessionRows.map((session) => session.id);
  const countsByMember = new Map<string, Record<ReportStatusKey, number>>();
  for (const member of members) {
    countsByMember.set(member.id, emptyCounts());
  }

  if (sessionIds.length > 0 && members.length > 0) {
    const attendances = await prisma.attendance.findMany({
      where: {
        schedule_id: { in: sessionIds },
        member_id: { in: members.map((member) => member.id) },
      },
      select: { member_id: true, status: true },
    });

    for (const record of attendances) {
      const counts = countsByMember.get(record.member_id);
      if (!counts) continue;
      counts[record.status as ReportStatusKey] += 1;
    }
  }

  const rows: ReportRow[] = members.map((member) => {
    const counts = countsByMember.get(member.id) ?? emptyCounts();
    const recorded = REPORT_STATUS_COLUMNS.reduce(
      (total, status) => total + counts[status],
      0
    );
    const unrecorded = Math.max(0, sessions - recorded);
    const position =
      member.positions.length > 0
        ? member.positions.map((entry) => entry.position.name).join(", ")
        : "—";

    return {
      memberId: member.id,
      name: member.full_name,
      nis: member.nis,
      classGrade: member.class_grade,
      organization: member.organization_type,
      position,
      counts,
      recorded,
      unrecorded,
      rate: calculateRate(counts, sessions),
    };
  });

  rows.sort((a, b) => {
    const classA = a.classGrade ?? "\uffff";
    const classB = b.classGrade ?? "\uffff";
    if (classA !== classB) return classA.localeCompare(classB, "id", { numeric: true });
    return a.name.localeCompare(b.name, "id");
  });

  const ratedRows = rows.filter((row) => row.rate !== null);
  const averageRate =
    ratedRows.length === 0
      ? 0
      : Math.round(
          ratedRows.reduce((total, row) => total + (row.rate ?? 0), 0) /
            ratedRows.length
        );

  return {
    from,
    to,
    sessions,
    activityName: activity?.name ?? null,
    organization: query.organization ?? null,
    includeInactive,
    rows,
    totals: buildReportTotals(rows),
    averageRate,
  };
}
