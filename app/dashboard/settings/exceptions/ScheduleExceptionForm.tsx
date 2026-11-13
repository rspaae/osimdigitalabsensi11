"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ActivityOption {
  id: string;
  name: string;
}

interface Props {
  date: string;
  activities: ActivityOption[];
}

export default function ScheduleExceptionForm({ date, activities }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState("");
  const [activityId, setActivityId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!startDate) {
      setMessage({ type: "error", text: "Tanggal wajib diisi." });
      return;
    }
    if (reason.trim().length < 5) {
      setMessage({ type: "error", text: "Alasan minimal 5 karakter." });
      return;
    }
    if (endDate && endDate < startDate) {
      setMessage({ type: "error", text: "Tanggal akhir tidak boleh sebelum tanggal awal." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/schedule-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: startDate,
          end_date: endDate || null,
          activity_id: activityId || null,
          reason: reason.trim(),
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          json?.details?.reason?.[0] ??
          json?.details?.date?.[0] ??
          json?.error ??
          "Gagal menyimpan pengecualian.";
        setMessage({ type: "error", text: String(detail) });
        return;
      }

      setMessage({
        type: "success",
        text: endDate
          ? `Rentang ${startDate} s.d. ${endDate} ditandai libur.`
          : `Tanggal ${startDate} ditandai libur.`,
      });
      setReason("");
      setEndDate("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Gagal menghubungi server. Periksa koneksi Anda." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="exception-form" onSubmit={handleSubmit}>
      <div className="manual-form-grid">
        <label className="report-field">
          <span>Dari tanggal</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={loading}
            required
          />
        </label>

        <label className="report-field">
          <span>Sampai tanggal (opsional)</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
            disabled={loading}
          />
        </label>

        <label className="report-field">
          <span>Kegiatan</span>
          <select
            value={activityId}
            onChange={(event) => setActivityId(event.target.value)}
            disabled={loading}
          >
            <option value="">Semua kegiatan</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>

        <label className="report-field manual-field-wide">
          <span>Alasan</span>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: libur nasional / kegiatan ditiadakan"
            maxLength={200}
            disabled={loading}
            required
          />
        </label>
      </div>

      <div className="manual-form-actions">
        <button type="submit" className="report-btn report-btn--primary" disabled={loading}>
          {loading ? "Menyimpan…" : "Tandai libur"}
        </button>
      </div>

      {message ? (
        <p className={`manual-message is-${message.type}`} role="status">{message.text}</p>
      ) : null}
    </form>
  );
}
