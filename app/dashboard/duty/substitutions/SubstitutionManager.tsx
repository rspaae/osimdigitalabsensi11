"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ActivityOption {
  id: string;
  code: string;
  name: string;
}

export interface RosterMemberInfo {
  member_id: string;
  full_name: string;
  class_grade: string | null;
  organization_type: "OSIS" | "MPK" | "GENERAL";
}

export interface DutyScheduleItem {
  id: string;
  activity_id: string;
  cycle_week: "WEEK_1" | "WEEK_2";
  day_of_week: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  start_time_wib: string;
  cutoff_time_wib: string;
  title: string | null;
  roster_members: RosterMemberInfo[];
}

export interface MemberOption {
  id: string;
  full_name: string;
  class_grade: string | null;
  organization_type: "OSIS" | "MPK" | "GENERAL";
}

export interface SubstitutionItem {
  id: string;
  duty_schedule_id: string;
  duty_date: string; // YYYY-MM-DD
  reason: string;
  status: "APPROVED" | "CANCELLED";
  created_at: string;
  duty_schedule: {
    start_time_wib: string;
    cutoff_time_wib: string;
    cycle_week: string;
    day_of_week: string;
    activity: {
      id: string;
      code: string;
      name: string;
    };
  };
  original_member: {
    id: string;
    full_name: string;
    nis: string | null;
    class_grade: string | null;
  };
  substitute_member: {
    id: string;
    full_name: string;
    nis: string | null;
    class_grade: string | null;
  };
  creator: {
    id: string;
    username: string;
    role: string;
  };
}

interface Props {
  cycleStartDate: string | null;
  activities: ActivityOption[];
  activityOffsets: Record<string, number>;
  schedules: DutyScheduleItem[];
  allMembers: MemberOption[];
  initialSubstitutions: SubstitutionItem[];
  todayDateStr: string;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Senin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Kamis",
  FRIDAY: "Jumat",
  SATURDAY: "Sabtu",
  SUNDAY: "Minggu",
};

const DAY_INDEX_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export default function SubstitutionManager({
  cycleStartDate,
  activities,
  activityOffsets,
  schedules,
  allMembers,
  initialSubstitutions,
  todayDateStr,
}: Props) {
  const router = useRouter();

  // Form State
  const [dutyDate, setDutyDate] = useState<string>(todayDateStr);
  const [selectedActivityId, setSelectedActivityId] = useState<string>(
    activities[0]?.id ?? ""
  );
  const [originalMemberId, setOriginalMemberId] = useState<string>("");
  const [substituteMemberId, setSubstituteMemberId] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // UI State
  const [substitutions, setSubstitutions] = useState<SubstitutionItem[]>(initialSubstitutions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 1. Hitung hari dan minggu siklus untuk tanggal yang dipilih
  const resolvedScheduleInfo = useMemo(() => {
    if (!cycleStartDate || !dutyDate) return null;

    const startParts = cycleStartDate.split("-").map(Number);
    const dateParts = dutyDate.split("-").map(Number);
    if (startParts.length !== 3 || dateParts.length !== 3) return null;

    const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
    const targetUtc = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const diffDays = Math.floor((targetUtc - startUtc) / (24 * 60 * 60 * 1000));

    if (diffDays < 0) {
      return { error: "Tanggal yang dipilih sebelum tanggal awal siklus absensi." };
    }

    const dayOfWeek = DAY_INDEX_MAP[new Date(targetUtc).getUTCDay()];
    if (dayOfWeek === "SATURDAY" || dayOfWeek === "SUNDAY") {
      return { error: `Hari ${DAY_LABELS[dayOfWeek]} adalah hari libur (tidak ada jadwal piket).` };
    }

    const cycleDay = diffDays % 14;
    const globalWeek = cycleDay < 7 ? "WEEK_1" : "WEEK_2";

    // Cek offset kegiatan
    const act = activities.find((a) => a.id === selectedActivityId);
    const offset = act ? (activityOffsets[act.code.toUpperCase()] ?? 0) : 0;
    const effectiveWeek =
      offset === 1
        ? globalWeek === "WEEK_1"
          ? "WEEK_2"
          : "WEEK_1"
        : globalWeek;

    // Cari schedule yang cocok
    const matchingSchedule = schedules.find(
      (s) =>
        s.activity_id === selectedActivityId &&
        s.cycle_week === effectiveWeek &&
        s.day_of_week === dayOfWeek
    );

    return {
      dayOfWeek,
      globalWeek,
      effectiveWeek,
      matchingSchedule,
      activity: act,
    };
  }, [cycleStartDate, dutyDate, selectedActivityId, activities, activityOffsets, schedules]);

  // Daftar anggota yang bisa dipilih untuk original_member (yang bertugas di jadwal tersebut)
  const rosterMembers = useMemo(() => {
    return resolvedScheduleInfo?.matchingSchedule?.roster_members ?? [];
  }, [resolvedScheduleInfo]);

  // Daftar anggota yang bisa dipilih sebagai substitute (yang TIDAK ada di jadwal tersebut)
  const eligibleSubstitutes = useMemo(() => {
    const rosterIds = new Set(rosterMembers.map((r) => r.member_id));
    return allMembers.filter((m) => !rosterIds.has(m.id) && m.id !== originalMemberId);
  }, [allMembers, rosterMembers, originalMemberId]);

  // Submit Ajukan Substitusi
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedScheduleInfo?.matchingSchedule) {
      setMessage({ type: "error", text: "Jadwal piket tidak ditemukan untuk hari dan tanggal tersebut." });
      return;
    }
    if (!originalMemberId || !substituteMemberId) {
      setMessage({ type: "error", text: "Pilih anggota yang digantikan dan anggota pengganti." });
      return;
    }
    if (reason.trim().length < 3) {
      setMessage({ type: "error", text: "Alasan substitusi minimal 3 karakter." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/v1/duty/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duty_schedule_id: resolvedScheduleInfo.matchingSchedule.id,
          duty_date: dutyDate,
          original_member_id: originalMemberId,
          substitute_member_id: substituteMemberId,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? json.message ?? "Gagal menyimpan tukar piket.");
      }

      setMessage({ type: "success", text: "Tukar piket berhasil disetujui & dicatat ke sistem!" });
      setOriginalMemberId("");
      setSubstituteMemberId("");
      setReason("");

      // Tambahkan ke state daftar
      if (json.data) {
        setSubstitutions((prev) => [json.data as SubstitutionItem, ...prev]);
      }
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setBusy(false);
    }
  }

  // Batalkan Substitusi
  async function handleCancel(subId: string, subName: string) {
    if (!confirm(`Batalkan tukar piket untuk ${subName}?`)) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/duty/substitutions/${subId}/cancel`, {
        method: "PATCH",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? json.message ?? "Gagal membatalkan substitusi.");
      }

      setSubstitutions((prev) =>
        prev.map((item) =>
          item.id === subId ? { ...item, status: "CANCELLED" } : item
        )
      );

      setMessage({ type: "success", text: "Substitusi berhasil dibatalkan." });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal membatalkan." });
    } finally {
      setBusy(false);
    }
  }

  // Filter daftar substitusi
  const filteredSubstitutions = substitutions.filter((sub) => {
    if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchOrig = sub.original_member.full_name.toLowerCase().includes(q);
      const matchSub = sub.substitute_member.full_name.toLowerCase().includes(q);
      const matchReason = sub.reason.toLowerCase().includes(q);
      if (!matchOrig && !matchSub && !matchReason) return false;
    }
    return true;
  });

  return (
    <div className="settings-page-body">
      {/* Banner Penjelasan */}
      <div className="roster-automation-banner">
        <span className="roster-automation-icon" aria-hidden="true">🔄</span>
        <div>
          <h2 className="roster-automation-title">Pengelolaan Tukar Piket / Substitusi</h2>
          <p className="roster-automation-desc">
            Jika ada anggota yang berhalangan hadir pada hari tugasnya, catat anggota penggantinya di sini.
            Saat siswa pengganti menempelkan kartu RFID di jam piket jadwal tersebut, sistem otomatis mencatatnya sebagai <strong>HADIR (Substitusi)</strong>.
          </p>
        </div>
      </div>

      {message && (
        <div className={`cycle-message cycle-message--${message.type}`} role="status" style={{ marginBottom: 20 }}>
          {message.text}
        </div>
      )}

      {/* Formulir Pengajuan Tukar Piket */}
      <section className="member-form-card" style={{ marginBottom: 28 }}>
        <h2 className="cycle-section-title">1. Ajukan &amp; Catat Tukar Piket</h2>
        <p className="cycle-form-description">
          Pilih tanggal dan kegiatan, lalu tentukan siswa yang digantikan dan siswa yang menggantikan.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="member-form-grid">
            {/* Input Tanggal */}
            <div className="cycle-field">
              <label htmlFor="sub-date" className="cycle-field-label">
                Tanggal Piket (WIB)
              </label>
              <input
                id="sub-date"
                type="date"
                className="cycle-field-input"
                value={dutyDate}
                onChange={(e) => {
                  setDutyDate(e.target.value);
                  setOriginalMemberId("");
                  setSubstituteMemberId("");
                }}
                required
                disabled={busy}
              />
            </div>

            {/* Input Kegiatan */}
            <div className="cycle-field">
              <label htmlFor="sub-activity" className="cycle-field-label">
                Kegiatan Piket
              </label>
              <select
                id="sub-activity"
                className="cycle-field-input"
                value={selectedActivityId}
                onChange={(e) => {
                  setSelectedActivityId(e.target.value);
                  setOriginalMemberId("");
                  setSubstituteMemberId("");
                }}
                disabled={busy}
              >
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.name} ({act.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Jadwal yang Terdeteksi Otomatis */}
          <div style={{ margin: "14px 0", padding: "12px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            {resolvedScheduleInfo?.error ? (
              <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                ⚠️ {resolvedScheduleInfo.error}
              </span>
            ) : resolvedScheduleInfo?.matchingSchedule ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#1e293b" }}>
                  <strong>Jadwal Terpilih:</strong> {resolvedScheduleInfo.activity?.name} · {DAY_LABELS[resolvedScheduleInfo.dayOfWeek]} ({resolvedScheduleInfo.effectiveWeek === "WEEK_1" ? "Minggu 1" : "Minggu 2"})
                </span>
                <span className="duty-day-time-badge">
                  ⏰ {resolvedScheduleInfo.matchingSchedule.start_time_wib} – {resolvedScheduleInfo.matchingSchedule.cutoff_time_wib} WIB ({rosterMembers.length} Petugas)
                </span>
              </div>
            ) : (
              <span style={{ color: "#d97706", fontSize: 13 }}>
                ⚠️ Tidak ada jadwal yang cocok untuk kombinasi hari &amp; minggu ini.
              </span>
            )}
          </div>

          <div className="member-form-grid">
            {/* Siswa yang Digantikan */}
            <div className="cycle-field">
              <label htmlFor="sub-orig-member" className="cycle-field-label">
                Siswa Asli (Yang Berhalangan Hadir)
              </label>
              <select
                id="sub-orig-member"
                className="cycle-field-input"
                value={originalMemberId}
                onChange={(e) => {
                  setOriginalMemberId(e.target.value);
                  if (substituteMemberId === e.target.value) setSubstituteMemberId("");
                }}
                required
                disabled={busy || rosterMembers.length === 0}
              >
                <option value="">-- Pilih Siswa dari Daftar Roster Hari Ini --</option>
                {rosterMembers.map((r) => (
                  <option key={r.member_id} value={r.member_id}>
                    {r.full_name} ({r.organization_type} {r.class_grade ? `— ${r.class_grade}` : ""})
                  </option>
                ))}
              </select>
              <span className="cycle-field-hint">
                Hanya menampilkan siswa yang memang dijadwalkan piket pada hari ini.
              </span>
            </div>

            {/* Siswa Pengganti */}
            <div className="cycle-field">
              <label htmlFor="sub-new-member" className="cycle-field-label">
                Siswa Pengganti (Yang Akan Bertugas)
              </label>
              <select
                id="sub-new-member"
                className="cycle-field-input"
                value={substituteMemberId}
                onChange={(e) => setSubstituteMemberId(e.target.value)}
                required
                disabled={busy || !originalMemberId}
              >
                <option value="">-- Pilih Siswa Pengganti --</option>
                {eligibleSubstitutes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.organization_type} {m.class_grade ? `— ${m.class_grade}` : ""})
                  </option>
                ))}
              </select>
              <span className="cycle-field-hint">
                Siswa pengganti tidak boleh yang sudah terjadwal piket di shift yang sama.
              </span>
            </div>
          </div>

          {/* Alasan */}
          <div className="cycle-field" style={{ marginTop: 12 }}>
            <label htmlFor="sub-reason" className="cycle-field-label">
              Alasan Tukar Piket / Keterangan
            </label>
            <input
              id="sub-reason"
              type="text"
              placeholder="Contoh: Sakit, Dispensasi Lomba FLS2N, Izin Acara Keluarga"
              className="cycle-field-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              maxLength={255}
              disabled={busy}
            />
          </div>

          <div className="cycle-form-actions" style={{ marginTop: 20 }}>
            <button
              type="submit"
              className="cycle-submit-btn"
              disabled={busy || !resolvedScheduleInfo?.matchingSchedule || !originalMemberId || !substituteMemberId}
            >
              {busy ? "Menyimpan..." : "✓ Simpan & Setujui Tukar Piket"}
            </button>
          </div>
        </form>
      </section>

      {/* Tabel Riwayat Tukar Piket */}
      <section className="member-list-card">
        <div className="member-list-heading">
          <div>
            <h2 className="cycle-section-title">2. Riwayat &amp; Status Tukar Piket</h2>
            <p className="cycle-form-description">
              Daftar seluruh pergantian piket yang disetujui. Petugas pengganti yang tercatat di sini otomatis diterima server saat tap RFID.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/dashboard/duty/sapa-pagi" className="member-secondary-link">
              Lihat Roster Piket →
            </Link>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="ui-stats-grid" style={{ marginBottom: "20px" }}>
          <div className="ui-stat-card is-mint">
            <span className="ui-stat-label">Total Pengajuan</span>
            <div className="ui-stat-value">{substitutions.length}</div>
            <span className="ui-stat-sub">Semua rekaman</span>
          </div>
          <div className="ui-stat-card is-sky">
            <span className="ui-stat-label">Disetujui / Aktif</span>
            <div className="ui-stat-value">
              {substitutions.filter((s) => s.status === "APPROVED").length}
            </div>
            <span className="ui-stat-sub">Berlaku untuk RFID</span>
          </div>
          <div className="ui-stat-card is-rose">
            <span className="ui-stat-label">Dibatalkan</span>
            <div className="ui-stat-value">
              {substitutions.filter((s) => s.status === "CANCELLED").length}
            </div>
            <span className="ui-stat-sub">Tidak berlaku</span>
          </div>
        </div>

        {/* Filter List & Search */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div className="ui-search-input-wrap" style={{ flex: "1 1 280px", maxWidth: "420px" }}>
            <span className="ui-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Cari siswa atau alasan..."
              className="ui-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="ui-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Bersihkan pencarian"
              >
                ✕
              </button>
            )}
          </div>

          <div className="ui-filter-pills" role="tablist" aria-label="Filter status substitusi">
            <button
              type="button"
              className={`ui-pill-btn ${statusFilter === "ALL" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              Semua
              <span className="ui-pill-badge">{substitutions.length}</span>
            </button>
            <button
              type="button"
              className={`ui-pill-btn ${statusFilter === "APPROVED" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("APPROVED")}
            >
              Disetujui
              <span className="ui-pill-badge">
                {substitutions.filter((s) => s.status === "APPROVED").length}
              </span>
            </button>
            <button
              type="button"
              className={`ui-pill-btn ${statusFilter === "CANCELLED" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("CANCELLED")}
            >
              Dibatalkan
              <span className="ui-pill-badge">
                {substitutions.filter((s) => s.status === "CANCELLED").length}
              </span>
            </button>
          </div>
        </div>

        {filteredSubstitutions.length === 0 ? (
          <div className="ui-empty-card" style={{ padding: "40px 16px" }}>
            <div className="ui-empty-icon" aria-hidden="true">🔄</div>
            <p className="ui-empty-title">Tidak ada data tukar piket</p>
            <p className="ui-empty-desc">
              {searchQuery || statusFilter !== "ALL"
                ? "Tidak ada data yang cocok dengan kriteria filter."
                : "Gunakan formulir di atas untuk mengajukan pergantian piket jika ada siswa yang berhalangan."}
            </p>
          </div>
        ) : (
          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>No</th>
                  <th>Tanggal Piket</th>
                  <th>Kegiatan</th>
                  <th>Siswa Digantikan</th>
                  <th>Siswa Pengganti</th>
                  <th>Alasan</th>
                  <th>Status</th>
                  <th>Dicatat Oleh</th>
                  <th style={{ width: 80, textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubstitutions.map((sub, idx) => {
                  const isApproved = sub.status === "APPROVED";
                  return (
                    <tr key={sub.id}>
                      <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td>
                        <strong>{sub.duty_date}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {sub.duty_schedule?.activity?.name ?? "Piket"}
                        </span>
                        <small style={{ display: "block", color: "var(--text-muted)" }}>
                          {DAY_LABELS[sub.duty_schedule?.day_of_week] ?? ""} ({sub.duty_schedule?.start_time_wib}–{sub.duty_schedule?.cutoff_time_wib})
                        </small>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="ui-avatar" style={{ width: 28, height: 28, fontSize: 11, background: "linear-gradient(135deg, #fee2e2, #fca5a5)", color: "#991b1b" }}>
                            {initials(sub.original_member.full_name)}
                          </span>
                          <div>
                            <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                              ✕ {sub.original_member.full_name}
                            </span>
                            {sub.original_member.class_grade && (
                              <small style={{ display: "block", color: "var(--text-muted)" }}>
                                {sub.original_member.class_grade}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="ui-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {initials(sub.substitute_member.full_name)}
                          </span>
                          <div>
                            <span style={{ color: "#059669", fontWeight: 700 }}>
                              ✓ {sub.substitute_member.full_name}
                            </span>
                            {sub.substitute_member.class_grade && (
                              <small style={{ display: "block", color: "var(--text-muted)" }}>
                                {sub.substitute_member.class_grade}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13 }}>{sub.reason}</span>
                      </td>
                      <td>
                        <span className={`ui-status-badge ${isApproved ? "is-hadir" : "is-belum"}`}>
                          <span className="ui-status-dot" aria-hidden="true" />
                          {isApproved ? "Disetujui" : "Dibatalkan"}
                        </span>
                      </td>
                      <td>
                        <small style={{ color: "var(--text-secondary)" }}>
                          {sub.creator?.username ?? "Admin"} ({sub.creator?.role ?? ""})
                        </small>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isApproved && (
                          <button
                            type="button"
                            className="member-text-button"
                            style={{ color: "#dc2626", fontWeight: 600 }}
                            onClick={() => handleCancel(sub.id, sub.substitute_member.full_name)}
                            disabled={busy}
                          >
                            Batalkan
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
      </section>
    </div>
  );
}
