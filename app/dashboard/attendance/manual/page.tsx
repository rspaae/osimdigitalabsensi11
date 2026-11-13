import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { AppModule, PermissionAction } from "@/types/auth";
import { prisma } from "@/lib/db/prisma";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import { getCycleStatus } from "@/lib/services/duty.service";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/utils/attendance-status";
import CreateSessionForm from "./CreateSessionForm";
import ManualAttendanceForm from "./ManualAttendanceForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Input Manual Presensi | OSIS MPK SMKN 11 BANDUNG",
};

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const STATUS_TEXT: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Terbuka",
  CLOSED: "Ditutup",
};

function addMinutes(time: string, minutes: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const nextHour = Math.floor(total / 60) % 24;
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

export default async function ManualAttendancePage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!canAccessModule(user, AppModule.ATTENDANCE, PermissionAction.READ)) {
    redirect("/dashboard");
  }

  const canCreate = canAccessModule(user, AppModule.ATTENDANCE, PermissionAction.CREATE);
  const canCreateSession = canAccessModule(user, AppModule.SCHEDULES, PermissionAction.CREATE);

  const { dateStr: todayWib } = getWibDateComponents(new Date());
  const params = await searchParams;
  const selectedDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayWib;

  const dateUtc = parseDateOnlyToUtc(selectedDate);
  const { dayOfWeek } = getWibDateComponents(dateUtc);

  const [sessions, activities, members, cycle] = await Promise.all([
    prisma.activitySchedule.findMany({
      where: { date: dateUtc },
      orderBy: { start_time: "asc" },
      include: {
        activity: { select: { id: true, name: true } },
        attendances: {
          orderBy: { scan_time: "asc" },
          select: {
            id: true,
            status: true,
            method: true,
            notes: true,
            scan_time: true,
            member: { select: { full_name: true, class_grade: true } },
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.member.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ class_grade: "asc" }, { full_name: "asc" }],
      select: {
        id: true,
        full_name: true,
        class_grade: true,
        organization_type: true,
      },
    }),
    getCycleStatus(dateUtc).catch(() => null),
  ]);

  const cycleWeek =
    cycle && cycle.configured && "cycle_week" in cycle ? cycle.cycle_week : null;

  // Prefill jam sesi dari jadwal piket pada hari & minggu siklus yang sama.
  const dutyDefaults: Record<string, { start: string; late: string; end: string }> = {};
  if (cycleWeek) {
    const duties = await prisma.dutySchedule.findMany({
      where: { is_active: true, day_of_week: dayOfWeek, cycle_week: cycleWeek },
      select: {
        activity_id: true,
        start_time_wib: true,
        cutoff_time_wib: true,
      },
    });
    for (const duty of duties) {
      dutyDefaults[duty.activity_id] = {
        start: duty.start_time_wib,
        end: addMinutes(duty.cutoff_time_wib, 30),
        late: duty.cutoff_time_wib,
      };
    }
  }

  const sessionItems = sessions.map((session) => ({
    id: session.id,
    activityName: session.activity.name,
    status: session.status,
    startTime: getWibDateComponents(session.start_time).timeStr,
    cutoffTime: getWibDateComponents(session.late_threshold).timeStr,
    endTime: getWibDateComponents(session.end_time).timeStr,
    records: session.attendances.map((record) => ({
      id: record.id,
      memberName: record.member.full_name,
      classGrade: record.member.class_grade,
      status: record.status,
      method: record.method,
      notes: record.notes,
      time: getWibDateComponents(record.scan_time).timeStr,
    })),
  }));

  const totalRecords = sessionItems.reduce((total, item) => total + item.records.length, 0);
  const manualRecords = sessionItems.reduce(
    (total, item) => total + item.records.filter((record) => record.method === "MANUAL").length,
    0
  );

  return (
    <main className="settings-page manual-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/dashboard/attendance" className="breadcrumb-link">Rekap presensi</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Input manual</span>
        </nav>

        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Input Manual Presensi</h1>
          <span className="settings-role-badge">{user.role}</span>
        </div>
        <p className="settings-page-desc">
          Catat kehadiran tanpa kartu RFID: buat sesi kegiatan untuk tanggal tertentu, lalu
          tambahkan status Hadir, Terlambat, Izin, atau Sakit. Status Alpa hanya ditetapkan
          melalui rekonsiliasi sesi yang sudah ditutup.
        </p>
      </header>

      <div className="settings-page-body manual-body">
        <form className="manual-toolbar" method="get" action="/dashboard/attendance/manual">
          <label className="report-field">
            <span>Tanggal sesi</span>
            <input type="date" name="date" defaultValue={selectedDate} />
          </label>
          <button type="submit" className="report-btn report-btn--primary">Tampilkan</button>
          <div className="manual-summary">
            <span><strong>{sessions.length}</strong> sesi</span>
            <span><strong>{totalRecords}</strong> rekaman</span>
            <span><strong>{manualRecords}</strong> manual</span>
          </div>
        </form>

        <p className="manual-date-note">{dateFormatter.format(dateUtc)} · WIB</p>

        {canCreateSession ? (
          <CreateSessionForm
            date={selectedDate}
            activities={activities}
            defaults={dutyDefaults}
          />
        ) : (
          <p className="manual-note">
            Akun Anda tidak memiliki izin membuat sesi baru. Hubungi pengurus dengan akses
            jadwal bila sesi belum tersedia.
          </p>
        )}

        {sessionItems.length === 0 ? (
          <div className="manual-empty">
            <strong>Belum ada sesi pada tanggal ini</strong>
            <span>
              Sesi biasanya dibuat otomatis saat scan RFID pertama. Untuk input manual tanpa
              scan, buat sesi terlebih dahulu di atas.
            </span>
          </div>
        ) : (
          <div className="manual-grid">
            {sessionItems.map((session) => (
              <section className="manual-card" key={session.id} aria-labelledby={`${session.id}-title`}>
                <header className="manual-head">
                  <div>
                    <h2 className="manual-title" id={`${session.id}-title`}>{session.activityName}</h2>
                    <p className="manual-meta">
                      {session.startTime}–{session.endTime} WIB · cutoff {session.cutoffTime} WIB
                    </p>
                  </div>
                  <span className={`manual-status is-${session.status.toLowerCase()}`}>
                    {STATUS_TEXT[session.status] ?? session.status}
                  </span>
                </header>

                {session.records.length === 0 ? (
                  <p className="manual-empty-records">Belum ada rekaman pada sesi ini.</p>
                ) : (
                  <div className="manual-records-wrap">
                    <table className="manual-records">
                      <thead>
                        <tr>
                          <th scope="col">Nama</th>
                          <th scope="col">Kelas</th>
                          <th scope="col">Status</th>
                          <th scope="col">Metode</th>
                          <th scope="col">Waktu</th>
                          <th scope="col">Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.records.map((record) => (
                          <tr key={record.id}>
                            <td>{record.memberName}</td>
                            <td>{record.classGrade ?? "—"}</td>
                            <td>
                              <span
                                className={`dh-status is-${
                                  ATTENDANCE_STATUS_STYLE[record.status] ?? "belum"
                                }`}
                              >
                                {ATTENDANCE_STATUS_LABEL[record.status] ?? record.status}
                              </span>
                            </td>
                            <td>{record.method === "RFID" ? "RFID" : "Manual"}</td>
                            <td className="manual-time">{record.time}</td>
                            <td>{record.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {canCreate ? (
                  <ManualAttendanceForm
                    sessionId={session.id}
                    sessionStatus={session.status}
                    members={members}
                  />
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
