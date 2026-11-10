import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import sapaRoster from "@/scripts/roster-sapa-pagi.json";
import { getFreshUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { getDutySchedules } from "@/lib/services/duty.service";
import DutyRosterManager, {
  type DutyActivity,
  type DutyMember,
  type DutySchedule,
  type RosterEntry,
} from "./DutyRosterManager";

export const instant = false;

export const metadata: Metadata = {
  title: "Jadwal & Roster Sapa Pagi | OSIS MPK SMKN 11 BANDUNG",
};

export default async function SapaPagiDutyPage() {
  const user = await getFreshUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/dashboard");

  const [activity, members, cycleSetting] = await Promise.all([
    prisma.activity.findUnique({
      where: { code: "SAPA_PAGI" },
      select: { id: true, code: true, name: true, is_active: true },
    }),
    prisma.member.findMany({
      select: {
        id: true,
        nis: true,
        full_name: true,
        class_grade: true,
        organization_type: true,
        status: true,
      },
      orderBy: { full_name: "asc" },
    }),
    prisma.systemSetting.findUnique({
      where: { key: "cycle_start_date" },
      select: { value: true },
    }),
  ]);

  const storedSchedules = activity
    ? await getDutySchedules({ activity_id: activity.id })
    : [];
  const attendanceCounts = await Promise.all(
    storedSchedules.map((schedule) =>
      prisma.attendance.count({ where: { duty_schedule_id: schedule.id } })
    )
  );

  const initialActivity: DutyActivity | null = activity;
  const initialSchedules: DutySchedule[] = storedSchedules.map((schedule, index) => ({
    id: schedule.id,
    cycle_week: schedule.cycle_week,
    day_of_week: schedule.day_of_week,
    start_time_wib: schedule.start_time_wib,
    cutoff_time_wib: schedule.cutoff_time_wib,
    title: schedule.title,
    is_active: schedule.is_active,
    attendance_count: attendanceCounts[index],
    roster_members: schedule.roster_members.map((rosterMember) => ({
      member_id: rosterMember.member_id,
      full_name: rosterMember.member.full_name,
      status: rosterMember.member.status,
    })),
  }));
  const initialMembers: DutyMember[] = members.map((member) => ({
    id: member.id,
    nis: member.nis,
    full_name: member.full_name,
    class_grade: member.class_grade,
    organization_type: member.organization_type,
    status: member.status,
  }));
  const rosterEntries: RosterEntry[] = sapaRoster.map((entry) => ({
    name: entry.name,
    organization_type: entry.organization_type === "MPK" ? "MPK" : "OSIS",
    cycle_week: entry.week === "WEEK_2" ? "WEEK_2" : "WEEK_1",
    day_of_week: entry.day as RosterEntry["day_of_week"],
  }));

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Jadwal &amp; Roster Sapa Pagi</span>
        </nav>
        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Jadwal &amp; Roster Sapa Pagi</h1>
          <span className="settings-role-badge">SUPERADMIN</span>
        </div>
        <p className="settings-page-desc">
          Siapkan jadwal berulang Week 1 dan Week 2, lalu hubungkan nama di roster
          resmi ke anggota berdasarkan nama persis dan jenis organisasi.
        </p>
      </header>

      <div className="settings-page-body">
        <DutyRosterManager
          initialActivity={initialActivity}
          initialSchedules={initialSchedules}
          members={initialMembers}
          rosterEntries={rosterEntries}
          cycleStartDate={cycleSetting?.value ?? null}
        />
      </div>
    </main>
  );
}
