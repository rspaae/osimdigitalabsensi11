import { AttendanceStatus, CycleWeek, DayOfWeek } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateCycleWeek, getWibDateComponents } from "@/lib/utils/duty-cycle";
import { expandDateRange, isScheduleCancelled } from "@/lib/utils/schedule-exception";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import {
  applyCycleWeekOffset,
  getActivityWeekOffsets,
  weekLabel,
} from "./activity-week.service";

export interface RecapPerson {
  memberId: string;
  fullName: string;
  classGrade: string | null;
  organizationType: string;
  status: AttendanceStatus | null;
  timeWib: string | null;
  method: "RFID" | "MANUAL" | null;
  notes: string | null;
  isSubstitution: boolean;
  replaces: string | null;
}

export interface DailyActivityRecap {
  activityId: string;
  activityName: string;
  weekLabel: string;
  startTime: string;
  cutoffTime: string;
  recorded: RecapPerson[];
  absent: RecapPerson[];
  outside: RecapPerson[];
  hasDutySchedule: boolean;
}

export interface DailyRecapDay {
  date: string;
  dayLabel: string;
  holidayReason: string | null;
  cancelledActivities: string[];
  activities: DailyActivityRecap[];
  recordedCount: number;
  absentCount: number;
}

const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

const STATUS_SCORE: Record<AttendanceStatus, number> = {
  HADIR: 6,
  TERLAMBAT: 5,
  IZIN: 4,
  SAKIT: 3,
  ALPA: 2,
  DI_LUAR_JADWAL: 1,
};

type AttendanceRecord = {
  member_id: string;
  status: AttendanceStatus;
  method: "RFID" | "MANUAL";
  notes: string | null;
  scan_time: Date;
  member: {
    id: string;
    full_name: string;
    class_grade: string | null;
    organization_type: string;
  };
};

function pickBest(map: Map<string, AttendanceRecord>, record: AttendanceRecord) {
  const current = map.get(record.member_id);
  if (!current || STATUS_SCORE[record.status] > STATUS_SCORE[current.status]) {
    map.set(record.member_id, record);
  }
}

function toPerson(
  member: {
    id: string;
    full_name: string;
    class_grade: string | null;
    organization_type: string;
  },
  record: AttendanceRecord | undefined,
  options?: { isSubstitution?: boolean; replaces?: string | null }
): RecapPerson {
  return {
    memberId: member.id,
    fullName: member.full_name,
    classGrade: member.class_grade,
    organizationType: member.organization_type,
    status: record?.status ?? null,
    timeWib: record ? getWibDateComponents(record.scan_time).timeStr : null,
    method: record?.method ?? null,
    notes: record?.notes ?? null,
    isSubstitution: options?.isSubstitution ?? false,
    replaces: options?.replaces ?? null,
  };
}

/**
 * Rekap kehadiran per tanggal: untuk setiap tanggal, setiap kegiatan piket
 * menampilkan siapa yang sudah tercatat dan siapa yang belum absen.
 */
export async function getDailyRecap(params: {
  from: string;
  to: string;
}): Promise<DailyRecapDay[]> {
  const dates = expandDateRange(params.from, params.to);
  const rangeStart = parseDateOnlyToUtc(dates[0]);
  const rangeEnd = parseDateOnlyToUtc(dates[dates.length - 1]);

  const [cycleSetting, weekOffsets, exceptions, schedules, sessions, substitutions] =
    await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "cycle_start_date" } }),
      getActivityWeekOffsets(),
      prisma.scheduleException.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        select: { date: true, activity_id: true, reason: true },
      }),
      prisma.dutySchedule.findMany({
        where: { is_active: true },
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
      prisma.activitySchedule.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        select: {
          date: true,
          activity: { select: { id: true, name: true, code: true } },
          attendances: {
            select: {
              member_id: true,
              status: true,
              method: true,
              notes: true,
              scan_time: true,
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
      }),
      prisma.dutySubstitution.findMany({
        where: {
          duty_date: { gte: rangeStart, lte: rangeEnd },
          status: "APPROVED",
        },
        select: {
          duty_date: true,
          duty_schedule_id: true,
          original_member_id: true,
          original_member: { select: { full_name: true } },
          substitute_member: {
            select: {
              id: true,
              full_name: true,
              class_grade: true,
              organization_type: true,
            },
          },
        },
      }),
    ]);

  const cycleStart = cycleSetting?.value ?? null;

  // Jadwal per hari (semua minggu), lalu disaring dengan minggu efektif.
  const schedulesByDay = new Map<DayOfWeek, typeof schedules>();
  for (const schedule of schedules) {
    const list = schedulesByDay.get(schedule.day_of_week) ?? [];
    list.push(schedule);
    schedulesByDay.set(schedule.day_of_week, list);
  }

  // Absensi per tanggal + kegiatan + anggota (pilih status terbaik bila ganda).
  const attendanceByDateActivity = new Map<string, Map<string, AttendanceRecord>>();
  const sessionActivitiesByDate = new Map<string, Map<string, { id: string; name: string; code: string }>>();
  for (const session of sessions) {
    const dateStr = session.date.toISOString().slice(0, 10);
    const activityKey = `${dateStr}|${session.activity.id}`;

    const activityMap =
      sessionActivitiesByDate.get(dateStr) ?? new Map<string, { id: string; name: string; code: string }>();
    activityMap.set(session.activity.id, session.activity);
    sessionActivitiesByDate.set(dateStr, activityMap);

    const memberMap = attendanceByDateActivity.get(activityKey) ?? new Map<string, AttendanceRecord>();
    for (const record of session.attendances) {
      pickBest(memberMap, record as AttendanceRecord);
    }
    attendanceByDateActivity.set(activityKey, memberMap);
  }

  const substitutionsByDateSchedule = new Map<string, typeof substitutions>();
  for (const substitution of substitutions) {
    const key = `${substitution.duty_date.toISOString().slice(0, 10)}|${substitution.duty_schedule_id}`;
    const list = substitutionsByDateSchedule.get(key) ?? [];
    list.push(substitution);
    substitutionsByDateSchedule.set(key, list);
  }

  const exceptionsByDate = new Map<string, Array<{ activity_id: string | null; reason: string }>>();
  for (const exception of exceptions) {
    const dateStr = exception.date.toISOString().slice(0, 10);
    const list = exceptionsByDate.get(dateStr) ?? [];
    list.push({ activity_id: exception.activity_id, reason: exception.reason });
    exceptionsByDate.set(dateStr, list);
  }

  return dates.map((dateStr) => {
    const dateUtc = parseDateOnlyToUtc(dateStr);
    const { dayOfWeek } = getWibDateComponents(dateUtc);
    const exceptionsForDate = exceptionsByDate.get(dateStr) ?? [];
    const allCancelled = exceptionsForDate.some((item) => item.activity_id === null);

    let cycleWeek: CycleWeek | null = null;
    if (cycleStart && dateStr >= cycleStart) {
      try {
        cycleWeek = calculateCycleWeek(dateUtc, cycleStart).cycleWeek;
      } catch {
        cycleWeek = null;
      }
    }

    const activities: DailyActivityRecap[] = [];
    const handledActivityIds = new Set<string>();
    const cancelledActivities: string[] = [];

    const daySchedules = schedulesByDay.get(dayOfWeek) ?? [];

    if (cycleWeek) {
      for (const schedule of daySchedules) {
        const effectiveWeek = applyCycleWeekOffset(
          cycleWeek,
          weekOffsets.get(schedule.activity.code.toUpperCase()) ?? 0
        );
        if (effectiveWeek !== schedule.cycle_week) continue;

        if (allCancelled || isScheduleCancelled(exceptionsForDate, schedule.activity.id)) {
          cancelledActivities.push(schedule.activity.name);
          handledActivityIds.add(schedule.activity.id);
          continue;
        }

        handledActivityIds.add(schedule.activity.id);
        const memberMap = attendanceByDateActivity.get(`${dateStr}|${schedule.activity.id}`) ?? new Map();
        const daySubs = substitutionsByDateSchedule.get(`${dateStr}|${schedule.id}`) ?? [];
        const replacedIds = new Set(daySubs.map((sub) => sub.original_member_id));
        const substituteIds = new Set(daySubs.map((sub) => sub.substitute_member.id));

        const recorded: RecapPerson[] = [];
        const absent: RecapPerson[] = [];
        const outside: RecapPerson[] = [];

        for (const roster of schedule.roster_members) {
          if (replacedIds.has(roster.member.id)) continue;
          const record = memberMap.get(roster.member.id);
          const person = toPerson(roster.member, record);
          (record ? recorded : absent).push(person);
        }

        for (const substitution of daySubs) {
          const record = memberMap.get(substitution.substitute_member.id);
          recorded.push(
            toPerson(substitution.substitute_member, record, {
              isSubstitution: true,
              replaces: substitution.original_member.full_name,
            })
          );
        }

        for (const record of memberMap.values()) {
          if (schedule.roster_members.some((roster) => roster.member.id === record.member_id)) continue;
          if (substituteIds.has(record.member_id)) continue;
          outside.push({
            ...toPerson(record.member, record),
            status: record.status,
          });
        }

        recorded.sort(
          (a, b) =>
            (b.status ? STATUS_SCORE[b.status] : 0) - (a.status ? STATUS_SCORE[a.status] : 0) ||
            a.fullName.localeCompare(b.fullName, "id")
        );
        absent.sort((a, b) => a.fullName.localeCompare(b.fullName, "id"));

        activities.push({
          activityId: schedule.activity.id,
          activityName: schedule.activity.name,
          weekLabel: weekLabel(schedule.cycle_week),
          startTime: schedule.start_time_wib,
          cutoffTime: schedule.cutoff_time_wib,
          recorded,
          absent,
          outside,
          hasDutySchedule: true,
        });
      }
    }

    // Sesi tanpa jadwal piket (mis. kegiatan tambahan / hari tanpa roster)
    const sessionActivities = sessionActivitiesByDate.get(dateStr);
    if (sessionActivities) {
      for (const activity of sessionActivities.values()) {
        if (handledActivityIds.has(activity.id)) continue;
        if (allCancelled || isScheduleCancelled(exceptionsForDate, activity.id)) {
          cancelledActivities.push(activity.name);
          continue;
        }
        const memberMap = attendanceByDateActivity.get(`${dateStr}|${activity.id}`) ?? new Map();
        const recorded = [...memberMap.values()]
          .map((record) => toPerson(record.member, record))
          .sort(
            (a, b) =>
              (b.status ? STATUS_SCORE[b.status] : 0) - (a.status ? STATUS_SCORE[a.status] : 0) ||
              a.fullName.localeCompare(b.fullName, "id")
          );
        activities.push({
          activityId: activity.id,
          activityName: activity.name,
          weekLabel: "",
          startTime: "",
          cutoffTime: "",
          recorded,
          absent: [],
          outside: [],
          hasDutySchedule: false,
        });
      }
    }

    const recordedCount = activities.reduce((total, activity) => total + activity.recorded.length, 0);
    const absentCount = activities.reduce((total, activity) => total + activity.absent.length, 0);

    return {
      date: dateStr,
      dayLabel: DAY_LABEL[dayOfWeek] ?? dayOfWeek,
      holidayReason: allCancelled ? (exceptionsForDate[0]?.reason ?? "Libur") : null,
      cancelledActivities,
      activities,
      recordedCount,
      absentCount,
    };
  });
}
