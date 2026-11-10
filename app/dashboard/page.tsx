import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/context";
import { getCycleStatus } from "@/lib/services/duty.service";
import { prisma } from "@/lib/db/prisma";

export const instant = false;

export const metadata: Metadata = {
  title: "Ringkasan | OSIS MPK SMKN 11 BANDUNG",
};

const numberFormat = new Intl.NumberFormat("id-ID");

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [activeMembers, membersWithRfid, activeSchedules, activeDevices, rosterAssignments] = await Promise.all([
    prisma.member.count({ where: { status: "ACTIVE" } }),
    prisma.member.count({ where: { status: "ACTIVE", rfid_uid: { not: null } } }),
    prisma.dutySchedule.count({ where: { is_active: true } }),
    prisma.device.count({ where: { is_active: true } }),
    prisma.dutyRosterMember.count({ where: { duty_schedule: { is_active: true } } }),
  ]);

  let cycleStatus: Awaited<ReturnType<typeof getCycleStatus>> | null = null;
  try {
    cycleStatus = await getCycleStatus();
  } catch {
    cycleStatus = null;
  }

  const rfidCoverage = activeMembers === 0 ? 0 : Math.round((membersWithRfid / activeMembers) * 100);
  const needsRfid = Math.max(0, activeMembers - membersWithRfid);
  const scanReady = needsRfid === 0 && activeDevices > 0 && activeSchedules > 0 && cycleStatus?.configured === true;

  return (
    <main className="dashboard-overview">
      <section className="overview-heading">
        <div>
          <p className="overview-eyebrow">IKHTISAR OPERASIONAL</p>
          <h1>Selamat datang, {user.username}</h1>
          <p className="overview-description">Pantau kesiapan data anggota, jadwal piket, dan perangkat absensi dari satu tempat.</p>
        </div>
        <span className="overview-date">Zona waktu WIB</span>
      </section>

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

      <section className="overview-metrics" aria-label="Ringkasan data">
        <article className="overview-metric-card">
          <span className="overview-metric-label">Anggota aktif</span>
          <strong>{numberFormat.format(activeMembers)}</strong>
          <span className="overview-metric-note">terdaftar di master anggota</span>
          <span className="overview-metric-symbol" aria-hidden="true">01</span>
        </article>
        <article className="overview-metric-card">
          <span className="overview-metric-label">UID kartu tertaut</span>
          <strong>{numberFormat.format(membersWithRfid)}<small> / {numberFormat.format(activeMembers)}</small></strong>
          <span className="overview-metric-note">{numberFormat.format(needsRfid)} kartu perlu didaftarkan</span>
          <span className="overview-metric-symbol" aria-hidden="true">02</span>
        </article>
        <article className="overview-metric-card">
          <span className="overview-metric-label">Jadwal aktif</span>
          <strong>{numberFormat.format(activeSchedules)}</strong>
          <span className="overview-metric-note">jadwal piket siap digunakan</span>
          <span className="overview-metric-symbol" aria-hidden="true">03</span>
        </article>
        <article className="overview-metric-card">
          <span className="overview-metric-label">Perangkat aktif</span>
          <strong>{numberFormat.format(activeDevices)}</strong>
          <span className="overview-metric-note">ESP32 terdaftar pada sistem</span>
          <span className="overview-metric-symbol" aria-hidden="true">04</span>
        </article>
      </section>

      <div className="overview-content-grid">
        <section className="overview-panel overview-readiness">
          <div className="overview-panel-heading">
            <div>
              <p className="overview-eyebrow">KONDISI SISTEM</p>
              <h2>Kesiapan absensi RFID</h2>
            </div>
            <span className={`overview-status ${scanReady ? "is-ready" : "is-pending"}`}>
              {scanReady ? "Siap scan" : "Perlu persiapan"}
            </span>
          </div>
          <div className="overview-progress-labels">
            <span>Kartu anggota tertaut</span>
            <strong>{rfidCoverage}%</strong>
          </div>
          <div className="overview-progress-track" role="progressbar" aria-label="Persentase UID anggota tertaut" aria-valuenow={rfidCoverage} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${rfidCoverage}%` }} />
          </div>
          <div className="overview-readiness-details">
            <div><span className={`overview-check ${membersWithRfid > 0 ? "is-done" : ""}`}>{membersWithRfid > 0 ? "✓" : "–"}</span><span>{numberFormat.format(membersWithRfid)} dari {numberFormat.format(activeMembers)} anggota memiliki UID kartu</span></div>
            <div><span className={`overview-check ${activeDevices > 0 ? "is-done" : ""}`}>{activeDevices > 0 ? "✓" : "–"}</span><span>{activeDevices > 0 ? `${numberFormat.format(activeDevices)} perangkat aktif` : "Perangkat ESP32 belum didaftarkan"}</span></div>
            <div><span className={`overview-check ${cycleStatus?.configured ? "is-done" : ""}`}>{cycleStatus?.configured ? "✓" : "–"}</span><span>{cycleStatus?.configured ? `Siklus dimulai ${cycleStatus.cycle_start_date}` : "Tanggal mulai siklus belum diatur"}</span></div>
          </div>
          {user.role === "SUPERADMIN" && (
            <div className="overview-actions">
              <Link href="/dashboard/members" className="overview-primary-action">Kelola UID anggota</Link>
              <Link href="/dashboard/devices" className="overview-secondary-action">Daftarkan perangkat</Link>
            </div>
          )}
        </section>

        <section className="overview-panel overview-cycle-panel">
          <div className="overview-panel-heading">
            <div>
              <p className="overview-eyebrow">JADWAL BERULANG</p>
              <h2>Siklus piket</h2>
            </div>
            <span className="overview-cycle-icon" aria-hidden="true">14</span>
          </div>
          {cycleStatus?.configured ? (
            <>
              <p className="overview-cycle-date">{cycleStatus.cycle_start_date}</p>
              <p className="overview-cycle-description">Tanggal awal siklus 14 hari · Asia/Jakarta</p>
              <div className="overview-cycle-weeks"><span>WEEK 1</span><span>WEEK 2</span></div>
            </>
          ) : (
            <>
              <p className="overview-cycle-date">Belum diatur</p>
              <p className="overview-cycle-description">Siklus diperlukan untuk menentukan roster yang berlaku.</p>
            </>
          )}
          {user.role === "SUPERADMIN" && <Link href="/dashboard/settings/cycle" className="overview-panel-link">Lihat pengaturan <span aria-hidden="true">→</span></Link>}
        </section>
      </div>

      {user.role === "SUPERADMIN" && (
        <section className="overview-panel overview-shortcuts">
          <div className="overview-panel-heading">
            <div>
              <p className="overview-eyebrow">AKSES CEPAT</p>
              <h2>Kelola sistem</h2>
            </div>
            <span className="overview-shortcut-count">{numberFormat.format(rosterAssignments)} penugasan aktif</span>
          </div>
          <div className="overview-shortcut-grid">
            <Link href="/dashboard/attendance" className="overview-shortcut-card"><span className="overview-shortcut-icon">P</span><span><strong>Rekap presensi</strong><small>Lihat log ketukan kartu RFID realtime</small></span><span className="overview-shortcut-arrow">→</span></Link>
            <Link href="/dashboard/members" className="overview-shortcut-card"><span className="overview-shortcut-icon">A</span><span><strong>Data anggota</strong><small>Nama, organisasi, dan UID kartu</small></span><span className="overview-shortcut-arrow">→</span></Link>
            <Link href="/dashboard/duty/sapa-pagi" className="overview-shortcut-card"><span className="overview-shortcut-icon">J</span><span><strong>Jadwal &amp; roster</strong><small>Kelola penugasan Sapa Pagi &amp; Danus</small></span><span className="overview-shortcut-arrow">→</span></Link>
            <Link href="/dashboard/devices" className="overview-shortcut-card"><span className="overview-shortcut-icon">I</span><span><strong>Perangkat IoT</strong><small>Registrasi ESP32 dan status koneksi</small></span><span className="overview-shortcut-arrow">→</span></Link>
          </div>
        </section>
      )}
    </main>
  );
}
