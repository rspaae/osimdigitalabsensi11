"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface ActivityOption {
  id: string;
  name: string;
}

interface TimeDefaults {
  start: string;
  late: string;
  end: string;
}

interface Props {
  date: string;
  activities: ActivityOption[];
  defaults: Record<string, TimeDefaults>;
}

export default function CreateSessionForm({ date, activities, defaults }: Props) {
  const router = useRouter();
  const initialActivity = activities[0]?.id ?? "";
  const initialTimes = defaults[initialActivity] ?? { start: "", late: "", end: "" };

  const [activityId, setActivityId] = useState(initialActivity);
  const [startTime, setStartTime] = useState(initialTimes.start);
  const [lateTime, setLateTime] = useState(initialTimes.late);
  const [endTime, setEndTime] = useState(initialTimes.end);
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activityName = useMemo(
    () => activities.find((activity) => activity.id === activityId)?.name ?? "Kegiatan",
    [activities, activityId]
  );

  function handleActivityChange(nextId: string) {
    setActivityId(nextId);
    const preset = defaults[nextId];
    if (preset) {
      setStartTime(preset.start);
      setLateTime(preset.late);
      setEndTime(preset.end);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!activityId) {
      setMessage({ type: "error", text: "Pilih kegiatan terlebih dahulu." });
      return;
    }
    if (!startTime || !lateTime || !endTime) {
      setMessage({
        type: "error",
        text: "Jam mulai, cutoff, dan jam selesai wajib diisi (format HH:MM).",
      });
      return;
    }
    if (!(startTime < lateTime && lateTime < endTime)) {
      setMessage({
        type: "error",
        text: "Urutan jam harus: mulai < cutoff < selesai.",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: activityId,
          date,
          start_time: startTime,
          late_threshold: lateTime,
          end_time: endTime,
          status,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage({
          type: "error",
          text: json?.error ?? "Gagal membuat sesi. Periksa jam dan kegiatan.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `Sesi ${activityName} berhasil dibuat. Silakan tambahkan presensi di kartu sesi.`,
      });
      router.refresh();
    } catch {
      setMessage({
        type: "error",
        text: "Gagal menghubungi server. Periksa koneksi Anda.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="manual-create">
      <summary>
        Buat sesi manual
        <span>Diperlukan bila belum ada scan RFID pada tanggal ini</span>
      </summary>

      <form className="manual-form" onSubmit={handleSubmit}>
        <div className="manual-form-grid">
          <label className="report-field manual-field-wide">
            <span>Kegiatan</span>
            <select
              value={activityId}
              onChange={(event) => handleActivityChange(event.target.value)}
              disabled={loading}
              required
            >
              {activities.length === 0 ? <option value="">Belum ada kegiatan aktif</option> : null}
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.name}</option>
              ))}
            </select>
          </label>

          <label className="report-field">
            <span>Jam mulai</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="report-field">
            <span>Cutoff (batas hadir)</span>
            <input
              type="time"
              value={lateTime}
              onChange={(event) => setLateTime(event.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="report-field">
            <span>Jam selesai</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="report-field">
            <span>Status sesi</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={loading}>
              <option value="OPEN">Terbuka (OPEN)</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Ditutup (CLOSED)</option>
            </select>
          </label>
        </div>

        {Object.keys(defaults).length > 0 ? (
          <p className="manual-hint">
            Jam terisi otomatis dari jadwal piket untuk kegiatan ini. Ubah bila perlu.
          </p>
        ) : (
          <p className="manual-hint">
            Belum ada jadwal piket pada tanggal ini, isi jam sesi secara manual.
          </p>
        )}

        <div className="manual-form-actions">
          <button type="submit" className="report-btn report-btn--primary" disabled={loading}>
            {loading ? "Menyimpan…" : "Buat sesi"}
          </button>
        </div>

        {message ? (
          <p className={`manual-message is-${message.type}`} role="status">{message.text}</p>
        ) : null}
      </form>
    </details>
  );
}
