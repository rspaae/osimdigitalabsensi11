import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { canAccessModule } from "@/lib/auth/rbac";
import { AppModule, PermissionAction } from "@/types/auth";
import { prisma } from "@/lib/db/prisma";
import { getWibDateComponents } from "@/lib/utils/duty-cycle";
import AttendanceViewer, { type AttendanceRecordItem } from "./AttendanceViewer";

export const instant = false;

export const metadata: Metadata = {
  title: "Rekap Presensi Realtime | OSIS MPK SMKN 11 BANDUNG",
};

interface PageProps {
  searchParams?: Promise<{ date?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canCorrect = canAccessModule(
    user,
    AppModule.HISTORY_CORRECTION,
    PermissionAction.CORRECT
  );

  const resolvedParams = searchParams ? await searchParams : {};
  const { dateStr: todayDateWib } = getWibDateComponents(new Date());
  const selectedDate = resolvedParams.date && /^\d{4}-\d{2}-\d{2}$/.test(resolvedParams.date)
    ? resolvedParams.date
    : todayDateWib;

  const startOfDayUtc = new Date(`${selectedDate}T00:00:00+07:00`);
  const endOfDayUtc = new Date(`${selectedDate}T23:59:59.999+07:00`);

  const attendances = await prisma.attendance.findMany({
    where: {
      scan_time: {
        gte: startOfDayUtc,
        lte: endOfDayUtc,
      },
    },
    include: {
      member: {
        select: {
          id: true,
          full_name: true,
          nis: true,
          class_grade: true,
          organization_type: true,
          rfid_uid: true,
        },
      },
      schedule: {
        select: {
          activity: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: {
      scan_time: "desc",
    },
  });

  const formattedRecords: AttendanceRecordItem[] = attendances.map((att) => ({
    id: att.id,
    scan_time: att.scan_time.toISOString(),
    status: att.status as AttendanceRecordItem["status"],
    method: att.method as AttendanceRecordItem["method"],
    notes: att.notes,
    scan_count: att.scan_count,
    last_scan_at: att.last_scan_at.toISOString(),
    auto_upgraded_at: att.auto_upgraded_at ? att.auto_upgraded_at.toISOString() : null,
    activity_name: att.schedule.activity.name,
    activity_code: att.schedule.activity.code,
    member: {
      id: att.member.id,
      full_name: att.member.full_name,
      nis: att.member.nis,
      class_grade: att.member.class_grade,
      organization_type: att.member.organization_type as "OSIS" | "MPK" | "GENERAL",
      rfid_uid: att.member.rfid_uid,
    },
  }));

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Rekap Presensi</span>
        </nav>
        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Rekapitulasi Presensi Kehadiran</h1>
          <span className="settings-role-badge">{user.role}</span>
        </div>
        <p className="settings-page-desc">
          Pantau seluruh rekaman presensi masuk siswa secara langsung (real-time) dari perangkat RFID scanner ESP32 dan verifikasi manual.
        </p>
      </header>

      <AttendanceViewer
        initialRecords={formattedRecords}
        selectedDate={selectedDate}
        canCorrect={canCorrect}
      />
    </main>
  );
}
