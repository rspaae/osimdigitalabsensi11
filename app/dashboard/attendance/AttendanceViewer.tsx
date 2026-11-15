"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [filterDate, setFilterDate] = useState(selectedDate);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleDateChange = (newDate: string) => {
    setFilterDate(newDate);
    router.push(`/dashboard/attendance?date=${newDate}`);
  };

  const getTodayWib = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now);
  };

  const getYesterdayWib = () => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now);
  };

  const todayWib = getTodayWib();
  const yesterdayWib = getYesterdayWib();

  const filteredRecords = initialRecords.filter((rec) => {
    if (statusFilter !== "ALL" && rec.status !== statusFilter) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = rec.member.full_name.toLowerCase().includes(q);
      const matchNis = rec.member.nis?.toLowerCase().includes(q) ?? false;
      const matchClass = rec.member.class_grade?.toLowerCase().includes(q) ?? false;
      const matchUid = rec.member.rfid_uid?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchNis && !matchClass && !matchUid) return false;
    }
    return true;
  });

  const totalHadir = initialRecords.filter((r) => r.status === "HADIR").length;
  const totalDiLuarJadwal = initialRecords.filter((r) => r.status === "DI_LUAR_JADWAL").length;
  const totalTerlambat = initialRecords.filter((r) => r.status === "TERLAMBAT").length;
  const totalIzinSakit = initialRecords.filter((r) => r.status === "IZIN" || r.status === "SAKIT").length;

  return (
    <div className="settings-page-body">
      {/* Live Status Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div className="ui-live-pill">
          <span className="ui-pulse-dot" aria-hidden="true" />
          <span>Scanner ESP32 Aktif &bull; Real-time Feed</span>
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Sinkronisasi otomatis ke server Vercel &bull; Waktu WIB (+07)
        </div>
      </div>

      {/* Kartu Ringkasan Kehadiran UI/UX Pro Max */}
      <section className="ui-stats-grid" aria-label="Ringkasan Statistik Kehadiran">
        <article className="ui-stat-card accent-indigo">
          <div className="ui-stat-header">
            <span className="ui-stat-label">Total Ketukan</span>
            <span className="ui-stat-icon-wrap" aria-hidden="true">📡</span>
          </div>
          <div className="ui-stat-value">{initialRecords.length}</div>
          <div className="ui-stat-desc">Tap RFID & presensi manual pada {filterDate}</div>
        </article>

        <article className="ui-stat-card accent-mint">
          <div className="ui-stat-header">
            <span className="ui-stat-label">Hadir Petugas</span>
            <span className="ui-stat-icon-wrap" aria-hidden="true">✓</span>
          </div>
          <div className="ui-stat-value" style={{ color: "#059669" }}>{totalHadir}</div>
          <div className="ui-stat-desc">Sesuai jadwal piket (tepat waktu)</div>
        </article>

        <article className="ui-stat-card accent-sky">
          <div className="ui-stat-header">
            <span className="ui-stat-label">Di Luar Jadwal</span>
            <span className="ui-stat-icon-wrap" aria-hidden="true">⚡</span>
          </div>
          <div className="ui-stat-value" style={{ color: "#0284c7" }}>{totalDiLuarJadwal}</div>
          <div className="ui-stat-desc">Anggota hadir di luar hari piketnya</div>
        </article>

        <article className="ui-stat-card accent-amber">
          <div className="ui-stat-header">
            <span className="ui-stat-label">Terlambat</span>
            <span className="ui-stat-icon-wrap" aria-hidden="true">⏰</span>
          </div>
          <div className="ui-stat-value" style={{ color: "#d97706" }}>{totalTerlambat}</div>
          <div className="ui-stat-desc">Melewati batas jam piket yang ditentukan</div>
        </article>
      </section>

      {/* Kontrol Filter & Pencarian Cepat */}
      <section className="member-list-card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Baris 1: Filter Tanggal & Search */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, alignItems: "end" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label htmlFor="filter-date-input" className="cycle-field-label" style={{ margin: 0 }}>
                  Pilih Tanggal Presensi (WIB)
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleDateChange(todayWib)}
                    className={`ui-pill-btn ${filterDate === todayWib ? "is-active" : ""}`}
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateChange(yesterdayWib)}
                    className={`ui-pill-btn ${filterDate === yesterdayWib ? "is-active" : ""}`}
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    Kemarin
                  </button>
                </div>
              </div>
              <input
                id="filter-date-input"
                type="date"
                className="cycle-field-input"
                value={filterDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="filter-search-input" className="cycle-field-label" style={{ marginBottom: 6 }}>
                Cari Anggota / NIS / RFID
              </label>
              <div className="ui-search-input-wrap">
                <span className="ui-search-icon" aria-hidden="true">🔍</span>
                <input
                  id="filter-search-input"
                  type="text"
                  placeholder="Ketik nama, NIS, kelas, atau UID..."
                  className="ui-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    className="ui-search-clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Bersihkan pencarian"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Baris 2: Quick Filter Status Pills */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Filter Status Presensi:
            </div>
            <div className="ui-filter-pills">
              <button
                type="button"
                className={`ui-pill-btn ${statusFilter === "ALL" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
              >
                Semua
                <span className="ui-pill-badge">{initialRecords.length}</span>
              </button>
              <button
                type="button"
                className={`ui-pill-btn ${statusFilter === "HADIR" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("HADIR")}
              >
                Hadir Piket
                <span className="ui-pill-badge">{totalHadir}</span>
              </button>
              <button
                type="button"
                className={`ui-pill-btn ${statusFilter === "DI_LUAR_JADWAL" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("DI_LUAR_JADWAL")}
              >
                Di Luar Jadwal
                <span className="ui-pill-badge">{totalDiLuarJadwal}</span>
              </button>
              <button
                type="button"
                className={`ui-pill-btn ${statusFilter === "TERLAMBAT" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("TERLAMBAT")}
              >
                Terlambat
                <span className="ui-pill-badge">{totalTerlambat}</span>
              </button>
              {totalIzinSakit > 0 && (
                <button
                  type="button"
                  className={`ui-pill-btn ${statusFilter === "IZIN" ? "is-active" : ""}`}
                  onClick={() => setStatusFilter("IZIN")}
                >
                  Izin / Sakit
                  <span className="ui-pill-badge">{totalIzinSakit}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabel Data Rekap Presensi Polished */}
      <section className="member-list-card">
        <div className="member-list-heading">
          <div>
            <h2 className="cycle-section-title">
              Riwayat Presensi &mdash; {filterDate}
            </h2>
            <p className="cycle-form-description">
              Menampilkan {filteredRecords.length} dari total {initialRecords.length} rekaman presensi.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/dashboard/duty/sapa-pagi" className="member-secondary-link">
              Lihat Jadwal Piket &rarr;
            </Link>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="ui-empty-card">
            <div className="ui-empty-icon" aria-hidden="true">📋</div>
            <h3 className="ui-empty-title">
              {searchQuery || statusFilter !== "ALL"
                ? "Tidak ada data yang cocok dengan filter"
                : `Belum ada data presensi pada tanggal ${filterDate}`}
            </h3>
            <p className="ui-empty-desc">
              {searchQuery || statusFilter !== "ALL"
                ? "Coba sesuaikan kata kunci pencarian atau reset filter status untuk melihat seluruh data."
                : "Ketukan kartu RFID pada scanner ESP32 akan langsung muncul di sini secara otomatis."}
            </p>
            {(searchQuery || statusFilter !== "ALL") && (
              <button
                type="button"
                className="ui-pill-btn"
                style={{ marginTop: 14 }}
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <div className="member-table-wrap">
            <table className="member-table table-stack">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 44 }}>No</th>
                  <th scope="col">Waktu Scan</th>
                  <th scope="col">Anggota Presensi</th>
                  <th scope="col">Organisasi</th>
                  <th scope="col">Kelas / NIS</th>
                  <th scope="col">Kegiatan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Metode</th>
                  {canCorrect && <th scope="col" style={{ textAlign: "right" }}>Tindakan</th>}
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

                  let statusVariant = "belum";
                  let statusText = item.status as string;

                  if (item.status === "HADIR") {
                    statusVariant = "hadir";
                    statusText = "HADIR";
                  } else if (item.status === "DI_LUAR_JADWAL") {
                    statusVariant = "diluarjadwal";
                    statusText = "DI LUAR JADWAL";
                  } else if (item.status === "TERLAMBAT") {
                    statusVariant = "terlambat";
                    statusText = "TERLAMBAT";
                  } else if (item.status === "ALPA") {
                    statusVariant = "alpa";
                    statusText = "ALPA";
                  }

                  const initial = item.member.full_name.charAt(0).toUpperCase();
                  const isMpk = item.member.organization_type === "MPK";

                  return (
                    <tr key={item.id}>
                      <td data-label="No" style={{ color: "#94a3b8", fontSize: 12 }}>
                        {index + 1}
                      </td>

                      <td data-label="Waktu scan">
                        <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#1e293b" }}>
                          {timeFormatted} WIB
                        </strong>
                        {item.scan_count > 1 && (
                          <div style={{ marginTop: 2 }}>
                            <span className="ui-rfid-chip" style={{ fontSize: 9.5, color: "#475569" }}>
                              {item.scan_count}&times; tap
                            </span>
                          </div>
                        )}
                        {item.auto_upgraded_at && (
                          <div style={{ marginTop: 2, fontSize: 10.5, color: "#059669", fontWeight: 600 }}>
                            naik otomatis ke HADIR
                          </div>
                        )}
                      </td>

                      <td data-label="Anggota">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className={`ui-avatar ${isMpk ? "mpk" : ""}`} aria-hidden="true">
                            {initial}
                          </span>
                          <div>
                            <strong style={{ color: "#0f172a", fontSize: 13.5 }}>
                              {item.member.full_name}
                            </strong>
                            {item.member.rfid_uid && (
                              <div style={{ marginTop: 2 }}>
                                <span className="ui-rfid-chip">
                                  UID: {item.member.rfid_uid}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td data-label="Organisasi">
                        <span className={isMpk ? "badge-org-mpk" : "badge-org-osis"}>
                          {item.member.organization_type}
                        </span>
                      </td>

                      <td data-label="Kelas / NIS">
                        <span style={{ fontWeight: 550, color: "#334155" }}>
                          {item.member.class_grade ?? "—"}
                        </span>
                        {item.member.nis && (
                          <small style={{ display: "block", color: "#64748b", fontSize: 11 }}>
                            NIS: {item.member.nis}
                          </small>
                        )}
                      </td>

                      <td data-label="Kegiatan">
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#18735a" }}>
                          {item.activity_name}
                        </span>
                      </td>

                      <td data-label="Status">
                        <span className={`ui-status-badge ${statusVariant}`}>
                          <span className="ui-status-dot" aria-hidden="true" />
                          {statusText}
                        </span>
                      </td>

                      <td data-label="Metode">
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {item.method === "RFID" ? "📡 RFID ESP32" : "✍️ Manual"}
                        </span>
                      </td>

                      {canCorrect && (
                        <td data-label="Tindakan" style={{ textAlign: "right" }}>
                          <Link
                            href={`/dashboard/attendance/${item.id}`}
                            className="member-secondary-link"
                            style={{ fontSize: 11.5, padding: "4px 8px" }}
                          >
                            Koreksi &rarr;
                          </Link>
                        </td>
                      )}
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
