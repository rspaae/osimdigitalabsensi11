"use client";

import { useState } from "react";
import Link from "next/link";

export interface AttendanceRecordItem {
  id: string;
  scan_time: string; // ISO string
  status: "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "ALPA" | "DI_LUAR_JADWAL";
  method: "RFID" | "MANUAL";
  notes: string | null;
  scan_count: number;
  last_scan_at: string;
  auto_upgraded_at: string | null;
  activity_name: string;
  activity_code: string;
  member: {
    id: string;
    full_name: string;
    nis: string | null;
    class_grade: string | null;
    organization_type: "OSIS" | "MPK" | "GENERAL";
    rfid_uid: string | null;
  };
}

interface Props {
  initialRecords: AttendanceRecordItem[];
  selectedDate: string; // YYYY-MM-DD
  canCorrect: boolean;
}

export default function AttendanceViewer({ initialRecords, selectedDate, canCorrect }: Props) {
  const [filterDate, setFilterDate] = useState(selectedDate);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredRecords = initialRecords.filter((rec) => {
    if (statusFilter !== "ALL" && rec.status !== statusFilter) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = rec.member.full_name.toLowerCase().includes(q);
      const matchNis = rec.member.nis?.toLowerCase().includes(q) ?? false;
      const matchClass = rec.member.class_grade?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchNis && !matchClass) return false;
    }
    return true;
  });

  const totalHadir = initialRecords.filter((r) => r.status === "HADIR").length;
  const totalDiLuarJadwal = initialRecords.filter((r) => r.status === "DI_LUAR_JADWAL").length;
  const totalTerlambat = initialRecords.filter((r) => r.status === "TERLAMBAT").length;

  return (
    <div className="settings-page-body">
      {/* Kartu Ringkasan Kehadiran */}
      <section className="overview-metrics" style={{ marginBottom: 24 }}>
        <article className="overview-metric-card">
          <span className="overview-metric-label">Total Pemindaian</span>
          <strong>{initialRecords.length}</strong>
          <span className="overview-metric-note">presensi masuk pada tanggal ini</span>
          <span className="overview-metric-symbol" aria-hidden="true">📊</span>
        </article>

        <article className="overview-metric-card">
          <span className="overview-metric-label">Hadir Petugas</span>
          <strong style={{ color: "#059669" }}>{totalHadir}</strong>
          <span className="overview-metric-note">sesuai jadwal piket (on-time)</span>
          <span className="overview-metric-symbol" aria-hidden="true">✓</span>
        </article>

        <article className="overview-metric-card">
          <span className="overview-metric-label">Di Luar Jadwal</span>
          <strong style={{ color: "#0284c7" }}>{totalDiLuarJadwal}</strong>
          <span className="overview-metric-note">anggota bukan piket yang hadir</span>
          <span className="overview-metric-symbol" aria-hidden="true">⚡</span>
        </article>

        <article className="overview-metric-card">
          <span className="overview-metric-label">Terlambat</span>
          <strong style={{ color: "#d97706" }}>{totalTerlambat}</strong>
          <span className="overview-metric-note">melewati batas waktu piket</span>
          <span className="overview-metric-symbol" aria-hidden="true">!</span>
        </article>
      </section>

      {/* Filter Bar */}
      <section className="member-list-card" style={{ marginBottom: 24 }}>
        <div className="member-form-grid" style={{ alignItems: "center" }}>
          <div>
            <label htmlFor="filter-date-input" className="cycle-field-label">
              Pilih Tanggal Presensi (WIB)
            </label>
            <input
              id="filter-date-input"
              type="date"
              className="cycle-field-input"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                window.location.href = `/dashboard/attendance?date=${e.target.value}`;
              }}
            />
          </div>

          <div>
            <label htmlFor="filter-search-input" className="cycle-field-label">
              Cari Nama / NIS / Kelas
            </label>
            <input
              id="filter-search-input"
              type="text"
              placeholder="Ketik nama anggota..."
              className="cycle-field-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="filter-status-select" className="cycle-field-label">
              Filter Status
            </label>
            <select
              id="filter-status-select"
              className="cycle-field-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Semua Status ({initialRecords.length})</option>
              <option value="HADIR">HADIR (Piket)</option>
              <option value="DI_LUAR_JADWAL">DI LUAR JADWAL</option>
              <option value="TERLAMBAT">TERLAMBAT</option>
              <option value="IZIN">IZIN</option>
              <option value="SAKIT">SAKIT</option>
              <option value="ALPA">ALPA</option>
            </select>
          </div>
        </div>
      </section>

      {/* Tabel Data Rekap Presensi */}
      <section className="member-list-card">
        <div className="member-list-heading">
          <div>
            <h2 className="cycle-section-title">
              Riwayat Presensi — {filterDate}
            </h2>
            <p className="cycle-form-description">
              Merekam seluruh ketukan RFID dari perangkat scanner ESP32 dan verifikasi manual. Waktu mengacu ke WIB (Asia/Jakarta).
            </p>
          </div>
          <Link href="/dashboard/duty/sapa-pagi" className="member-secondary-link">
            Lihat Jadwal Piket →
          </Link>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="member-empty-state" style={{ padding: "40px 20px" }}>
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>
              Belum ada data presensi pada tanggal {filterDate}.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Data presensi akan otomatis muncul saat siswa menempelkan kartu RFID ke scanner ESP32 pada jam piket (05:30 – 06:00 WIB).
            </p>
          </div>
        ) : (
          <div className="member-table-wrap">
            <table className="member-table table-stack">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 50 }}>No</th>
                  <th scope="col">Jam Scan</th>
                  <th scope="col">Nama Anggota</th>
                  <th scope="col">Organisasi</th>
                  <th scope="col">Kelas / NIS</th>
                  <th scope="col">Kegiatan</th>
                  <th scope="col">Status Presensi</th>
                  <th scope="col">Metode</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item, index) => {
                  const scanDate = new Date(item.scan_time);
                  const timeFormatted = scanDate.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "Asia/Jakarta",
                  });

                  let statusBadgeClass = "badge-belum";
                  if (item.status === "HADIR") statusBadgeClass = "badge-hadir";
                  else if (item.status === "DI_LUAR_JADWAL") statusBadgeClass = "badge-diluarjadwal";
                  else if (item.status === "TERLAMBAT") statusBadgeClass = "badge-terlambat";
                  else if (item.status === "ALPA") statusBadgeClass = "badge-alpa";

                  const initial = item.member.full_name.charAt(0).toUpperCase();

                  return (
                    <tr key={item.id}>
                      <td data-label="No" style={{ color: "var(--text-muted)" }}>{index + 1}</td>
                      <td data-label="Jam scan">
                        <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                          {timeFormatted} WIB
                        </strong>
                        {item.scan_count > 1 && (
                          <small style={{ display: "block", marginTop: 3, color: "var(--text-muted)", fontSize: 11 }}>
                            {item.scan_count}× tap
                          </small>
                        )}
                        {item.auto_upgraded_at && (
                          <small style={{ display: "block", marginTop: 3, color: "#226b45", fontSize: 11 }}>
                            naik otomatis ke HADIR
                          </small>
                        )}
                      </td>
                      <td data-label="Nama anggota">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span className="duty-student-avatar">{initial}</span>
                          <div>
                            <strong>{item.member.full_name}</strong>
                            {item.member.rfid_uid && (
                              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                UID: {item.member.rfid_uid}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Organisasi">
                        <span className={item.member.organization_type === "MPK" ? "badge-org-mpk" : "badge-org-osis"}>
                          {item.member.organization_type}
                        </span>
                      </td>
                      <td data-label="Kelas / NIS">
                        {item.member.class_grade ?? "—"}
                        {item.member.nis && <small style={{ display: "block", color: "var(--text-muted)" }}>NIS: {item.member.nis}</small>}
                      </td>
                      <td data-label="Kegiatan">
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {item.activity_name}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`badge-status ${statusBadgeClass}`}>
                          {item.status === "DI_LUAR_JADWAL" ? "DI LUAR JADWAL" : item.status}
                        </span>
                        {canCorrect && (
                          <Link
                            href={`/dashboard/attendance/${item.id}`}
                            className="member-secondary-link"
                            style={{ display: "inline-block", marginTop: 6, fontSize: 11 }}
                          >
                            Koreksi →
                          </Link>
                        )}
                      </td>
                      <td data-label="Metode">
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {item.method === "RFID" ? "📡 RFID ESP32" : "✍️ Manual"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
