import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreshUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { getSubstitutions } from "@/lib/services/duty.service";
import { getActivityWeekOffsets } from "@/lib/services/activity-week.service";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import SubstitutionManager, {
  type ActivityOption,
  type DutyScheduleItem,
  type MemberOption,
  type SubstitutionItem,
} from "./SubstitutionManager";

export const instant = false;

export const metadata: Metadata = {
  title: "Tukar Piket / Substitusi | OSIS MPK SMKN 11 BANDUNG",
};

export default async function DutySubstitutionsPage() {
  const user = await getFreshUser();
  if (!user) redirect("/login");

  const { dateStr: todayDateWib } = getWibDateComponents(new Date());

  const [cycleSetting, activities, offsetsMap, rawSchedules, rawMembers, subResult] =
    await Promise.all([
      prisma.systemSetting.findUnique({
        where: { key: "cycle_start_date" },
        select: { value: true },
      }),
      prisma.activity.findMany({
        where: { is_active: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      getActivityWeekOffsets(),
      prisma.dutySchedule.findMany({
        where: { is_active: true },
        include: {
          activity: { select: { id: true, code: true, name: true } },
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
      }),
      prisma.member.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          full_name: true,
          class_grade: true,
          organization_type: true,
        },
        orderBy: { full_name: "asc" },
      }),
      getSubstitutions({ page: 1, limit: 50 }),
    ]);

  const activityOffsets: Record<string, number> = {};
  for (const [code, val] of offsetsMap.entries()) {
    activityOffsets[code] = val;
  }

  const formattedActivities: ActivityOption[] = activities.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
  }));

  const formattedSchedules: DutyScheduleItem[] = rawSchedules.map((s) => ({
    id: s.id,
    activity_id: s.activity_id,
    cycle_week: s.cycle_week,
    day_of_week: s.day_of_week,
    start_time_wib: s.start_time_wib,
    cutoff_time_wib: s.cutoff_time_wib,
    title: s.title,
    roster_members: s.roster_members.map((r) => ({
      member_id: r.member_id,
      full_name: r.member.full_name,
      class_grade: r.member.class_grade,
      organization_type: r.member.organization_type as "OSIS" | "MPK" | "GENERAL",
    })),
  }));

  const formattedMembers: MemberOption[] = rawMembers.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    class_grade: m.class_grade,
    organization_type: m.organization_type as "OSIS" | "MPK" | "GENERAL",
  }));

  const formattedSubstitutions: SubstitutionItem[] = subResult.data.map((item) => ({
    id: item.id,
    duty_schedule_id: item.duty_schedule_id,
    duty_date: item.duty_date.toISOString().slice(0, 10),
    reason: item.reason,
    status: item.status as "APPROVED" | "CANCELLED",
    created_at: item.created_at.toISOString(),
    duty_schedule: {
      start_time_wib: item.duty_schedule.start_time_wib,
      cutoff_time_wib: item.duty_schedule.cutoff_time_wib,
      cycle_week: item.duty_schedule.cycle_week,
      day_of_week: item.duty_schedule.day_of_week,
      activity: {
        id: item.duty_schedule.activity.id,
        code: item.duty_schedule.activity.code,
        name: item.duty_schedule.activity.name,
      },
    },
    original_member: {
      id: item.original_member.id,
      full_name: item.original_member.full_name,
      nis: item.original_member.nis,
      class_grade: item.original_member.class_grade,
    },
    substitute_member: {
      id: item.substitute_member.id,
      full_name: item.substitute_member.full_name,
      nis: item.substitute_member.nis,
      class_grade: item.substitute_member.class_grade,
    },
    creator: {
      id: item.creator.id,
      username: item.creator.username,
      role: item.creator.role,
    },
  }));

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/dashboard/duty/sapa-pagi" className="breadcrumb-link">Jadwal &amp; Roster</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Tukar Piket</span>
        </nav>
        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Pengelolaan Tukar Piket (Substitusi)</h1>
          <span className="settings-role-badge">{user.role}</span>
        </div>
        <p className="settings-page-desc">
          Catat dan kelola pergantian petugas piket saat berhalangan hadir. Siswa pengganti akan otomatis diakui hadir oleh scanner RFID tanpa bentrok.
        </p>
      </header>

      <SubstitutionManager
        cycleStartDate={cycleSetting?.value ?? null}
        activities={formattedActivities}
        activityOffsets={activityOffsets}
        schedules={formattedSchedules}
        allMembers={formattedMembers}
        initialSubstitutions={formattedSubstitutions}
        todayDateStr={todayDateWib}
      />
    </main>
  );
}
