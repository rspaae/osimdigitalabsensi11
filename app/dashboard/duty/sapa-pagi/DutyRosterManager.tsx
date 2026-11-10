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
  status: "ACTIVE" | "INACTIVE" | "ALUMNI";
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
  roster_members: Array<{
    member_id: string;
    full_name: string;
    status: string;
  }>;
}

export interface RosterEntry {
  name: string;
  organization_type: "OSIS" | "MPK";
  cycle_week: CycleWeek;
  day_of_week: DutyDay;
}

interface Props {
  initialActivity: DutyActivity | null;
  initialSchedules: DutySchedule[];
  members: DutyMember[];
  rosterEntries: RosterEntry[];
  cycleStartDate: string | null;
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
const CUTOFF_TIME = "06:00";

function keyOf(week: CycleWeek, day: DutyDay) {
  return `${week}:${day}`;
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase("id-ID");
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

type MatchResult =
  | { kind: "matched"; member: DutyMember }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "inactive" }
  | { kind: "organization_mismatch" };

function resolveRosterEntry(entry: RosterEntry, membersByName: Map<string, DutyMember[]>): MatchResult {
  const candidates = membersByName.get(normalizeName(entry.name)) ?? [];
  if (candidates.length === 0) return { kind: "missing" };
  if (candidates.length > 1) return { kind: "ambiguous" };

  const member = candidates[0];
  if (member.status !== "ACTIVE") return { kind: "inactive" };
  if (member.organization_type !== entry.organization_type) {
    return { kind: "organization_mismatch" };
  }
  return { kind: "matched", member };
}

export default function DutyRosterManager({
  initialActivity,
  initialSchedules,
  members,
  rosterEntries,
  cycleStartDate,
}: Props) {
  const router = useRouter();
  const [activity, setActivity] = useState(initialActivity);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [startTime, setStartTime] = useState("05:30");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const membersByName = useMemo(() => {
    const result = new Map<string, DutyMember[]>();
    for (const member of members) {
      const key = normalizeName(member.full_name);
      result.set(key, [...(result.get(key) ?? []), member]);
    }
    return result;
  }, [members]);

  const matchResults = useMemo(
    () => rosterEntries.map((entry) => ({ entry, result: resolveRosterEntry(entry, membersByName) })),
    [membersByName, rosterEntries]
  );

  const schedulesByKey = useMemo(
    () => new Map(schedules.map((schedule) => [keyOf(schedule.cycle_week, schedule.day_of_week), schedule])),
    [schedules]
  );

  const matchedCount = matchResults.filter(({ result }) => result.kind === "matched").length;
  const activeScheduleCount = schedules.filter((schedule) => schedule.is_active).length;

  function mergeSchedule(updated: DutySchedule) {
    setSchedules((current) => {
      const map = new Map(current.map((schedule) => [keyOf(schedule.cycle_week, schedule.day_of_week), schedule]));
      map.set(keyOf(updated.cycle_week, updated.day_of_week), updated);
      return [...map.values()];
    });
  }

  async function prepareSchedules() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const errors: string[] = [];

    try {
      let currentActivity = activity;
      if (!currentActivity) {
        currentActivity = await requestData<DutyActivity>("/api/v1/activities", "POST", {
          code: "SAPA_PAGI",
          name: "Sapa Pagi",
          type: "ROUTINE",
          description: "Kegiatan penyambutan pagi OSIS dan MPK.",
          default_late_threshold_minutes: 15,
          is_active: true,
        });
        setActivity(currentActivity);
      } else if (!currentActivity.is_active) {
        currentActivity = await requestData<DutyActivity>(
          `/api/v1/activities/${currentActivity.id}`,
          "PATCH",
          { is_active: true }
        );
        setActivity(currentActivity);
      }

      const working = new Map(
        schedules.map((schedule) => [keyOf(schedule.cycle_week, schedule.day_of_week), schedule])
      );

      for (const week of WEEKS) {
        for (const day of DAYS) {
          const scheduleKey = keyOf(week, day);
          const existing = working.get(scheduleKey);
          if (existing) continue;

          try {
            const createdData = await requestData<Pick<DutySchedule, "id" | "cycle_week" | "day_of_week" | "start_time_wib" | "cutoff_time_wib" | "title" | "is_active">>("/api/v1/duty/schedules", "POST", {
              activity_id: currentActivity.id,
              cycle_week: week,
              day_of_week: day,
              start_time_wib: startTime,
              cutoff_time_wib: CUTOFF_TIME,
              title: `Sapa Pagi Week ${week === "WEEK_1" ? "1" : "2"} - ${DAY_LABELS[day]}`,
              is_active: true,
            });
            working.set(scheduleKey, { ...createdData, attendance_count: 0, roster_members: [] });
          } catch (error) {
            errors.push(`${week === "WEEK_1" ? "Week 1" : "Week 2"} ${DAY_LABELS[day]}: ${error instanceof Error ? error.message : "gagal dibuat"}`);
          }
        }
      }

      setSchedules([...working.values()]);
      router.refresh();

      if (errors.length > 0) {
        setMessage({ type: "error", text: `Sebagian jadwal belum siap: ${errors.join("; ")}` });
      } else {
        setMessage({ type: "success", text: "Kegiatan Sapa Pagi aktif dan seluruh jadwal yang belum ada berhasil dibuat." });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menyiapkan kegiatan dan jadwal." });
    } finally {
      setBusy(false);
    }
  }

  async function activateSchedule(schedule: DutySchedule) {
    if (busy) return;
    if (schedule.cutoff_time_wib !== CUTOFF_TIME) {
      setMessage({ type: "error", text: "Atur cutoff ke 06:00 terlebih dahulu agar jadwal Sapa Pagi mengikuti aturan absensi." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await requestData<Pick<DutySchedule, "is_active">>(
        `/api/v1/duty/schedules/${schedule.id}`,
        "PATCH",
        { is_active: true }
      );
      mergeSchedule({ ...schedule, is_active: updated.is_active });
      setMessage({ type: "success", text: `Jadwal ${schedule.cycle_week === "WEEK_1" ? "Week 1" : "Week 2"} ${DAY_LABELS[schedule.day_of_week]} diaktifkan.` });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Jadwal gagal diaktifkan." });
    } finally {
      setBusy(false);
    }
  }

  async function correctScheduleTime(schedule: DutySchedule) {
    if (busy) return;
    if (schedule.attendance_count > 0) {
      setMessage({ type: "error", text: "Jam tidak dapat diubah karena jadwal ini sudah memiliki riwayat absensi." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const updated = await requestData<Pick<DutySchedule, "start_time_wib" | "cutoff_time_wib">>(
        `/api/v1/duty/schedules/${schedule.id}`,
        "PATCH",
        { start_time_wib: startTime, cutoff_time_wib: CUTOFF_TIME }
      );
      mergeSchedule({ ...schedule, ...updated, attendance_count: 0 });
      setMessage({ type: "success", text: `Jam ${DAY_LABELS[schedule.day_of_week]} diperbarui ke ${startTime}–${CUTOFF_TIME} WIB.` });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Jam jadwal gagal diperbarui." });
    } finally {
      setBusy(false);
    }
  }

  async function applyMatchedRoster() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const results: string[] = [];
    const errors: string[] = [];

    try {
      for (const week of WEEKS) {
        for (const day of DAYS) {
          const schedule = schedulesByKey.get(keyOf(week, day));
          if (!schedule?.is_active || schedule.cutoff_time_wib !== CUTOFF_TIME) continue;

          const memberIds = [...new Set(
            matchResults
              .filter(({ entry, result }) =>
                entry.cycle_week === week &&
                entry.day_of_week === day &&
                result.kind === "matched"
              )
              .map(({ result }) => result.kind === "matched" ? result.member.id : "")
              .filter(Boolean)
          )];
          if (memberIds.length === 0) continue;

          try {
            const result = await requestData<{ added_count: number }>(
              `/api/v1/duty/schedules/${schedule.id}/roster/add`,
              "POST",
              { member_ids: memberIds }
            );
            results.push(`${DAY_LABELS[day]} ${week === "WEEK_1" ? "W1" : "W2"}: ${result.added_count} ditambahkan`);
          } catch (error) {
            errors.push(`${week === "WEEK_1" ? "Week 1" : "Week 2"} ${DAY_LABELS[day]}: ${error instanceof Error ? error.message : "gagal"}`);
          }
        }
      }

      router.refresh();
      if (errors.length > 0) {
        setMessage({ type: "error", text: `Ada roster yang gagal ditautkan: ${errors.join("; ")}` });
      } else if (results.length === 0) {
        setMessage({ type: "error", text: "Belum ada jadwal aktif dengan anggota yang cocok untuk ditautkan." });
      } else {
        setMessage({ type: "success", text: `Pencocokan selesai. ${results.join(" · ")}. Penugasan roster lama tetap dipertahankan.` });
      }
    } finally {
      setBusy(false);
    }
  }

  const canApplyRoster = matchResults.some(({ result }) => result.kind === "matched") &&
    schedules.some((schedule) => schedule.is_active && schedule.cutoff_time_wib === CUTOFF_TIME) &&
    activity?.is_active === true;

  return (
    <div className="cycle-settings-container">
      {!cycleStartDate && (
        <div className="dashboard-alert dashboard-alert--warning" role="status">
          Siklus belum dikonfigurasi. Jadwal dan roster dapat disiapkan sekarang, tetapi scan RFID akan ditolak sampai tanggal mulai siklus diatur.
          {" "}<Link href="/dashboard/settings/cycle" className="dashboard-alert-link">Atur siklus</Link>
        </div>
      )}

      <section className="member-form-card" aria-labelledby="schedule-setup-title">
        <h2 id="schedule-setup-title" className="cycle-section-title">1. Siapkan kegiatan dan jadwal</h2>
        <p className="cycle-form-description">
          Sistem membuat satu jadwal untuk setiap hari Senin–Jumat pada Week 1 dan Week 2. Jadwal yang sudah ada tidak ditimpa.
        </p>
        <div className="member-form-grid">
          <div className="cycle-field">
            <label htmlFor="sapa-start-time" className="cycle-field-label">Jam mulai (WIB)</label>
            <input
              id="sapa-start-time"
              type="time"
              className="cycle-field-input"
              value={startTime}
              max={CUTOFF_TIME}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={busy}
              required
            />
            <span className="cycle-field-hint">Default 05.30 mengikuti panduan roster yang tersedia.</span>
          </div>
          <div className="cycle-field">
            <span className="cycle-field-label">Batas scan (WIB)</span>
            <div className="member-readonly-value">06.00 — setelah cutoff scan ditolak</div>
          </div>
        </div>
        {activity && (
          <p className="member-status-note">
            Kegiatan {activity.name} ({activity.code}) · {activity.is_active ? "aktif" : "nonaktif"} · {activeScheduleCount}/10 jadwal aktif
          </p>
        )}
        <div className="cycle-form-actions">
          <button type="button" className="cycle-submit-btn" onClick={prepareSchedules} disabled={busy}>
            {busy ? "Memproses..." : "Siapkan Kegiatan & Jadwal yang Belum Ada"}
          </button>
        </div>
      </section>

      {message && (
        <div className={`cycle-message cycle-message--${message.type}`} role="status">
          {message.text}
        </div>
      )}

      <section className="member-list-card" aria-labelledby="roster-import-title">
        <div className="member-list-heading">
          <div>
            <h2 id="roster-import-title" className="cycle-section-title">2. Cocokkan dan hubungkan roster</h2>
            <p className="cycle-form-description">
              {rosterEntries.length} nama dari roster resmi dicocokkan ke {members.length} anggota. Pencocokan memakai nama persis dan organisasi; nama ambigu atau berbeda tidak ditebak.
            </p>
          </div>
          <Link href="/dashboard/members" className="member-secondary-link">Kelola anggota</Link>
        </div>

        {members.length === 0 && (
          <div className="cycle-not-configured member-roster-warning">
            <strong>Belum ada anggota terdaftar.</strong>
            <p>Daftarkan anggota dengan nama, NIS, kelas, dan organisasi yang sesuai sebelum menghubungkan roster.</p>
          </div>
        )}

        <div className="member-form-actions-row">
          <span className="member-match-summary">
            Cocok: {matchedCount}/{rosterEntries.length} · Belum cocok/ambigu: {rosterEntries.length - matchedCount}
          </span>
          <button
            type="button"
            className="cycle-submit-btn"
            onClick={applyMatchedRoster}
            disabled={busy || !canApplyRoster}
          >
            {busy ? "Menghubungkan..." : "Hubungkan semua nama yang cocok"}
          </button>
        </div>

        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th scope="col">Siklus</th>
                <th scope="col">Hari</th>
                <th scope="col">Jam</th>
                <th scope="col">Roster</th>
                <th scope="col">Anggota cocok</th>
                <th scope="col">Status</th>
                <th scope="col">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {WEEKS.flatMap((week) => DAYS.map((day) => {
                const schedule = schedulesByKey.get(keyOf(week, day));
                const entries = matchResults.filter(({ entry }) => entry.cycle_week === week && entry.day_of_week === day);
                const exact = entries.filter(({ result }) => result.kind === "matched");
                const issues = entries.filter(({ result }) => result.kind !== "matched");
                const assigned = schedule?.roster_members.length ?? 0;
                return (
                  <tr key={keyOf(week, day)}>
                    <td>{week === "WEEK_1" ? "Week 1" : "Week 2"}</td>
                    <td>{DAY_LABELS[day]}</td>
                    <td>{schedule ? `${schedule.start_time_wib}–${schedule.cutoff_time_wib}` : "—"}</td>
                    <td>{entries.length} nama · {assigned} terhubung</td>
                    <td>{exact.length}/{entries.length}</td>
                    <td>
                      {!schedule ? "Jadwal belum dibuat" : schedule.cutoff_time_wib !== CUTOFF_TIME ? "Periksa cutoff" : !schedule.is_active ? "Nonaktif" : "Siap"}
                    </td>
                    <td>
                      {schedule && schedule.cutoff_time_wib !== CUTOFF_TIME ? schedule.attendance_count === 0 ? (
                        <button type="button" className="member-text-button" disabled={busy} onClick={() => correctScheduleTime(schedule)}>
                          Atur jam
                        </button>
                      ) : (
                        <span className="member-action-hint">Ada riwayat; jam terkunci</span>
                      ) : schedule && !schedule.is_active ? (
                        <button type="button" className="member-text-button" disabled={busy} onClick={() => activateSchedule(schedule)}>
                          Aktifkan
                        </button>
                      ) : schedule && schedule.is_active && schedule.cutoff_time_wib !== CUTOFF_TIME ? (
                        <span className="member-action-hint">Cutoff harus 06.00</span>
                      ) : !schedule ? (
                        <span className="member-action-hint">Siapkan jadwal dahulu</span>
                      ) : (
                        <span className="member-action-hint">Aktif</span>
                      )}
                      {issues.length > 0 && (
                        <details className="member-issue-details">
                          <summary>{issues.length} perlu ditinjau</summary>
                          <ul>
                            {issues.map(({ entry, result }, index) => (
                              <li key={`${entry.name}-${index}`}>
                                {entry.name}: {result.kind === "missing" ? "belum terdaftar" : result.kind === "ambiguous" ? "nama ganda; perlu verifikasi NIS" : result.kind === "inactive" ? "anggota tidak aktif" : "organisasi tidak sama"}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        <p className="cycle-field-hint member-roster-footnote">
          Penautan bersifat tambah-saja dan idempoten: mengulang proses tidak menghapus atau mengganti penugasan yang sudah ada.
        </p>
      </section>
    </div>
  );
}
