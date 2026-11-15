"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CycleWeek = "WEEK_1" | "WEEK_2";
type DutyDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
type OrganizationType = "OSIS" | "MPK" | "GENERAL";

export interface DutyActivity {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface DutyMember {
  id: string;
  nis: string | null;
  full_name: string;
  class_grade: string | null;
  organization_type: OrganizationType;
  rfid_uid: string | null;
  status: "ACTIVE" | "INACTIVE" | "ALUMNI";
}

export interface RosterMemberItem {
  member_id: string;
  full_name: string;
  nis: string | null;
  class_grade: string | null;
  organization_type: OrganizationType;
  rfid_uid: string | null;
  status: string;
}

export interface DutySchedule {
  id: string;
  cycle_week: CycleWeek;
  day_of_week: DutyDay;
  start_time_wib: string;
  cutoff_time_wib: string;
  title: string | null;
  is_active: boolean;
  attendance_count: number;
  roster_members: RosterMemberItem[];
}

export interface RosterEntry {
  name: string;
  organization_type: "OSIS" | "MPK";
  cycle_week: CycleWeek;
  day_of_week: DutyDay;
}

export interface TodayAttendanceInfo {
  member_id: string;
  status: string;
  scan_time: string;
}

interface Props {
  initialActivity: DutyActivity | null;
  initialSchedules: DutySchedule[];
  members: DutyMember[];
  rosterEntries: RosterEntry[];
  cycleStartDate: string | null;
  todayDate: string;
  todayDayOfWeek: string;
  todayAttendances: TodayAttendanceInfo[];
}

interface ApiPayload {
  message?: string;
  error?: string;
  code?: string;
  data?: unknown;
}

const WEEKS: CycleWeek[] = ["WEEK_1", "WEEK_2"];
const DAYS: DutyDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const DAY_LABELS: Record<DutyDay, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

function keyOf(week: CycleWeek, day: DutyDay) {
  return `${week}:${day}`;
}

async function requestData<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? `Permintaan gagal (${response.status}).`);
  }
  if (payload.data === undefined) {
    throw new Error(payload.message ?? "Server tidak mengembalikan data yang diharapkan.");
  }
  return payload.data as T;
}

export default function DutyRosterManager({
  initialActivity,
  initialSchedules,
  members,
  rosterEntries,
  cycleStartDate,
  todayDate,
  todayDayOfWeek,
  todayAttendances,
}: Props) {
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState<CycleWeek>("WEEK_1");
  const [schedules, setSchedules] = useState<DutySchedule[]>(initialSchedules);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const schedulesByKey = useMemo(() => {
    const map = new Map<string, DutySchedule>();
    for (const schedule of schedules) {
      map.set(keyOf(schedule.cycle_week, schedule.day_of_week), schedule);
    }
    return map;
  }, [schedules]);

  const todayAttendanceMap = useMemo(() => {
    const map = new Map<string, TodayAttendanceInfo>();
    for (const att of todayAttendances) {
      map.set(att.member_id, att);
    }
    return map;
  }, [todayAttendances]);

  // Tambah anggota ke roster harian
  async function handleAddMember(scheduleId: string) {
    const memberId = selectedMemberToAdd[scheduleId];
    if (!memberId) {
      setMessage({ type: "error", text: "Pilih anggota terlebih dahulu dari daftar." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await requestData(`/api/v1/duty/schedules/${scheduleId}/roster/add`, "POST", {
        member_ids: [memberId],
      });

      const memberObj = members.find((m) => m.id === memberId);
      if (memberObj) {
        setSchedules((prev) =>
          prev.map((s) => {
            if (s.id !== scheduleId) return s;
            const alreadyExists = s.roster_members.some((r) => r.member_id === memberId);
            if (alreadyExists) return s;
            return {
              ...s,
              roster_members: [
                ...s.roster_members,
                {
                  member_id: memberObj.id,
                  full_name: memberObj.full_name,
                  nis: memberObj.nis,
                  class_grade: memberObj.class_grade,
                  organization_type: memberObj.organization_type,
                  rfid_uid: memberObj.rfid_uid,
                  status: memberObj.status,
                },
              ],
            };
          })
        );
      }

      setSelectedMemberToAdd((prev) => ({ ...prev, [scheduleId]: "" }));
      setMessage({ type: "success", text: "Petugas piket berhasil ditambahkan ke jadwal." });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal menambahkan anggota." });
    } finally {
      setBusy(false);
    }
  }

  // Hapus anggota dari roster harian
  async function handleRemoveMember(scheduleId: string, memberId: string, memberName: string) {
    if (!confirm(`Hapus ${memberName} dari daftar piket hari ini?`)) return;

    setBusy(true);
    setMessage(null);

    try {
      const schedule = schedules.find((s) => s.id === scheduleId);
      if (!schedule) return;

      const remainingMemberIds = schedule.roster_members
        .filter((r) => r.member_id !== memberId)
        .map((r) => r.member_id);

      await requestData(`/api/v1/duty/schedules/${scheduleId}/roster`, "POST", {
        member_ids: remainingMemberIds,
      });

      setSchedules((prev) =>
        prev.map((s) => {
          if (s.id !== scheduleId) return s;
          return {
            ...s,
            roster_members: s.roster_members.filter((r) => r.member_id !== memberId),
          };
        })
      );

      setMessage({ type: "success", text: `${memberName} telah dihapus dari roster piket.` });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal menghapus anggota." });
    } finally {
      setBusy(false);
    }
  }

  // Sinkronisasi massal roster bawaan jika diperlukan
  async function handleBulkApplyRoster() {
    setBusy(true);
    setMessage(null);
    try {
      let linked = 0;
      for (const week of WEEKS) {
        for (const day of DAYS) {
          const schedule = schedulesByKey.get(keyOf(week, day));
          if (!schedule) continue;
          const entriesForDay = rosterEntries.filter(
            (e) => e.cycle_week === week && e.day_of_week === day
          );
          const matchedIds: string[] = [];
          for (const entry of entriesForDay) {
            const found = members.find(
              (m) =>
                m.full_name.trim().toLowerCase() === entry.name.trim().toLowerCase() &&
                m.organization_type === entry.organization_type
            );
            if (found && !matchedIds.includes(found.id)) {
              matchedIds.push(found.id);
            }
          }
          if (matchedIds.length > 0) {
            await requestData(`/api/v1/duty/schedules/${schedule.id}/roster/add`, "POST", {
              member_ids: matchedIds,
            });
            linked += matchedIds.length;
          }
        }
      }
      setMessage({ type: "success", text: `Sinkronisasi selesai: ${linked} penugasan roster berhasil dihubungkan.` });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal sinkronisasi roster." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="duty-roster-container">
      {/* Banner Penjelasan Otomatisasi Polished */}
      <div className="roster-automation-banner" style={{ borderLeft: "4px solid #10b981" }}>
        <span className="roster-automation-icon" aria-hidden="true">✓</span>
        <div>
          <h2 className="roster-automation-title">Sistem Absensi Piket Berjalan Otomatis</h2>
          <p className="roster-automation-desc">
            Sistem absensi berulang secara otomatis setiap hari <strong>Senin s/d Jumat</strong> mengikuti siklus 14 hari dan jam jadwal masing-masing kegiatan (Sapa Pagi <strong>04:30 – 05:50 WIB</strong>, Danusan <strong>05:00 – 06:10 WIB</strong>).
            <strong> Tidak perlu membuka/menutup sesi absensi manual.</strong> Siswa yang bertugas piket hari ini akan otomatis tercatat sebagai <strong>HADIR</strong> saat tap kartu RFID, sedangkan siswa lain yang hadir tetap tercatat sebagai <strong>DI_LUAR_JADWAL</strong>.
          </p>
        </div>
      </div>

      {message && (
        <div className={`cycle-message cycle-message--${message.type}`} role="status" style={{ marginBottom: 20 }}>
          {message.text}
        </div>
      )}

      {/* Navigasi Pilihan Minggu Segmen Modern (Week 1 / Week 2) & Tukar Piket */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div className="ui-segmented-tabs" role="tablist" aria-label="Pilihan Siklus Minggu">
          <button
            type="button"
            role="tab"
            aria-selected={selectedWeek === "WEEK_1"}
            className={`ui-segmented-btn ${selectedWeek === "WEEK_1" ? "is-active" : ""}`}
            onClick={() => setSelectedWeek("WEEK_1")}
          >
            <span>📅</span>
            <span>Minggu 1 (Week 1)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedWeek === "WEEK_2"}
            className={`ui-segmented-btn ${selectedWeek === "WEEK_2" ? "is-active" : ""}`}
            onClick={() => setSelectedWeek("WEEK_2")}
          >
            <span>📅</span>
            <span>Minggu 2 (Week 2)</span>
          </button>
        </div>

        <Link
          href="/dashboard/duty/substitutions"
          className="ui-pill-btn"
          style={{ background: "#f0f9ff", color: "#0369a1", borderColor: "#bae6fd", fontWeight: 650, padding: "8px 16px" }}
        >
          <span>🔄</span>
          <span>Kelola Tukar Piket &rarr;</span>
        </Link>
      </div>

      {/* Tampilan Kartu Jadwal Per Hari Polished */}
      <div className="duty-days-grid">
        {DAYS.map((day) => {
          const schedule = schedulesByKey.get(keyOf(selectedWeek, day));
          const rosterList = schedule?.roster_members ?? [];
          const isTodaySchedule = todayDayOfWeek === day;

          return (
            <div key={keyOf(selectedWeek, day)} className={`ui-duty-day-card ${isTodaySchedule ? "is-today" : ""}`}>
              {/* Header Kartu Hari */}
              <div className="ui-duty-day-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div className="ui-duty-day-title">
                    <span>{DAY_LABELS[day]}</span>
                  </div>
                  <span className="ui-duty-day-time">
                    ⏰ {schedule ? `${schedule.start_time_wib} – ${schedule.cutoff_time_wib} WIB` : "Jadwal belum diatur"}
                  </span>
                  {isTodaySchedule && (
                    <span className="ui-duty-day-badge-today">
                      ● HARI INI
                    </span>
                  )}
                </div>
                <div>
                  <span className="ui-pill-btn" style={{ background: "#f8fafc", borderColor: "#e2e8f0", fontSize: 11 }}>
                    <strong>{rosterList.length}</strong> Siswa Petugas
                  </span>
                </div>
              </div>

              {/* Tabel Daftar Siswa Piket Polished */}
              {rosterList.length === 0 ? (
                <div className="ui-empty-card" style={{ padding: "28px 16px", margin: 16 }}>
                  <div className="ui-empty-icon" style={{ width: 38, height: 38, fontSize: 18, marginBottom: 8 }} aria-hidden="true">
                    👥
                  </div>
                  <h4 className="ui-empty-title" style={{ fontSize: 14 }}>Belum ada petugas terjadwal</h4>
                  <p className="ui-empty-desc" style={{ fontSize: 12 }}>
                    Pilih nama siswa di bawah untuk menambahkan ke daftar piket hari {DAY_LABELS[day]}.
                  </p>
                </div>
              ) : (
                <div className="member-table-wrap" style={{ margin: 0 }}>
                  <table className="duty-student-list">
                    <thead>
                      <tr>
                        <th style={{ width: 36, textAlign: "center" }}>No</th>
                        <th>Petugas Piket</th>
                        <th>Organisasi</th>
                        <th>Kelas / NIS</th>
                        <th>Kartu RFID</th>
                        <th>Status Hari Ini</th>
                        <th style={{ width: 50, textAlign: "center" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterList.map((petugas, index) => {
                        const att = todayAttendanceMap.get(petugas.member_id);
                        const initial = petugas.full_name.charAt(0).toUpperCase();
                        const isMpk = petugas.organization_type === "MPK";

                        let todayStatusBadge = (
                          <span className="ui-status-badge belum">
                            <span className="ui-status-dot" aria-hidden="true" />
                            Belum Tap
                          </span>
                        );
                        if (att) {
                          if (att.status === "HADIR") {
                            todayStatusBadge = (
                              <span className="ui-status-badge hadir">
                                <span className="ui-status-dot" aria-hidden="true" />
                                ✓ HADIR
                              </span>
                            );
                          } else if (att.status === "DI_LUAR_JADWAL") {
                            todayStatusBadge = (
                              <span className="ui-status-badge diluarjadwal">
                                <span className="ui-status-dot" aria-hidden="true" />
                                DI LUAR JADWAL
                              </span>
                            );
                          } else if (att.status === "TERLAMBAT") {
                            todayStatusBadge = (
                              <span className="ui-status-badge terlambat">
                                <span className="ui-status-dot" aria-hidden="true" />
                                TERLAMBAT
                              </span>
                            );
                          }
                        }

                        return (
                          <tr key={petugas.member_id}>
                            <td style={{ color: "#94a3b8", textAlign: "center", fontSize: 12 }}>
                              {index + 1}
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                <span className={`ui-avatar ${isMpk ? "mpk" : ""}`} aria-hidden="true">
                                  {initial}
                                </span>
                                <strong style={{ color: "#0f172a", fontSize: 13 }}>
                                  {petugas.full_name}
                                </strong>
                              </div>
                            </td>
                            <td>
                              <span className={isMpk ? "badge-org-mpk" : "badge-org-osis"}>
                                {petugas.organization_type}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 550, color: "#334155" }}>
                                {petugas.class_grade ?? "—"}
                              </span>
                              {petugas.nis && (
                                <small style={{ display: "block", color: "#64748b", fontSize: 10.5 }}>
                                  NIS: {petugas.nis}
                                </small>
                              )}
                            </td>
                            <td>
                              {petugas.rfid_uid ? (
                                <span className="ui-rfid-chip" style={{ color: "#059669" }}>
                                  ✓ {petugas.rfid_uid}
                                </span>
                              ) : (
                                <span className="ui-rfid-chip" style={{ color: "#d97706", background: "#fffbeb" }}>
                                  ⚠️ Belum Ada
                                </span>
                              )}
                            </td>
                            <td>
                              {isTodaySchedule ? (
                                todayStatusBadge
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 11.5 }}>
                                  Terjadwal
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {schedule && (
                                <button
                                  type="button"
                                  className="duty-btn-remove"
                                  title={`Hapus ${petugas.full_name} dari jadwal`}
                                  onClick={() => handleRemoveMember(schedule.id, petugas.member_id, petugas.full_name)}
                                  disabled={busy}
                                  aria-label={`Hapus ${petugas.full_name}`}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Formulir Cepat: Tambah Siswa ke Jadwal Hari Ini */}
              {schedule && (
                <div style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9", background: "#fcfdfc" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="duty-select-input"
                      style={{ fontSize: 13, borderColor: "#cbd5e1", borderRadius: 8 }}
                      value={selectedMemberToAdd[schedule.id] ?? ""}
                      onChange={(e) =>
                        setSelectedMemberToAdd((prev) => ({
                          ...prev,
                          [schedule.id]: e.target.value,
                        }))
                      }
                      disabled={busy}
                    >
                      <option value="">-- Pilih Siswa untuk Ditambahkan ke Roster --</option>
                      {members
                        .filter(
                          (m) =>
                            m.status === "ACTIVE" &&
                            !rosterList.some((r) => r.member_id === m.id)
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} ({m.organization_type} {m.class_grade ? `— ${m.class_grade}` : ""})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="duty-btn-add"
                      style={{ borderRadius: 8 }}
                      onClick={() => handleAddMember(schedule.id)}
                      disabled={busy || !selectedMemberToAdd[schedule.id]}
                    >
                      + Tambah Petugas
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Accordion Pengaturan Teknis & Sinkronisasi */}
      <details className="member-issue-details" style={{ maxWidth: "100%", marginTop: 32, background: "white", padding: 18, border: "1px solid var(--border-default)", borderRadius: 12 }}>
        <summary style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>
          ⚙️ Pengaturan Teknis &amp; Alat Sinkronisasi Massal
        </summary>
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Fitur sinkronisasi digunakan apabila ingin menautkan ulang otomatis daftar nama dari template data ke database.
          </p>
          <button
            type="button"
            className="cycle-submit-btn"
            style={{ width: "auto", padding: "8px 18px", fontSize: 13 }}
            onClick={handleBulkApplyRoster}
            disabled={busy}
          >
            {busy ? "Memproses..." : "Sinkronkan Ulang Semua Nama Roster"}
          </button>
        </div>
      </details>
    </div>
  );
}
