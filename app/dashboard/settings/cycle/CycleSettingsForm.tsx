"use client";

import { useState } from "react";

interface CycleStatusData {
  configured: boolean;
  cycle_start_date: string | null;
  current_wib: {
    dateStr: string;
    timeStr: string;
    dayOfWeek: string;
    timeWithSecondsStr?: string;
    wibDate?: Date;
  };
  cycle_week?: string | null;
  day_of_week?: string | null;
  cycle_day?: number | null;
  diff_days?: number | null;
  starts_in_days?: number;
}

interface Props {
  initialStatus: CycleStatusData;
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

export default function CycleSettingsForm({ initialStatus }: Props) {
  const [status, setStatus] = useState<CycleStatusData>(initialStatus);
  const [dateInput, setDateInput] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!dateInput) {
      setMessage({ type: "error", text: "Tanggal wajib diisi." });
      return;
    }

    // Validasi format YYYY-MM-DD di sisi client
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      setMessage({
        type: "error",
        text: "Format tanggal tidak valid. Gunakan format YYYY-MM-DD.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/duty/cycle-start-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_start_date: dateInput,
          description: description.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errMsg =
          json?.error?.message ?? json?.message ?? "Terjadi kesalahan.";
        setMessage({ type: "error", text: errMsg });
        return;
      }

      setStatus(json.data as CycleStatusData);
      setDateInput("");
      setDescription("");
      setMessage({
        type: "success",
        text: "Tanggal mulai siklus berhasil disimpan.",
      });
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
    <div className="cycle-settings-container">
      {/* Status Siklus Aktif */}
      <section className="cycle-status-card">
        <h2 className="cycle-section-title">Status Siklus Aktif</h2>

        {status.configured ? (
          <>
          <div className="cycle-status-grid">
            <div className="cycle-status-item">
              <span className="cycle-label">Tanggal Mulai Siklus</span>
              <span className="cycle-value">{status.cycle_start_date}</span>
            </div>
            <div className="cycle-status-item">
              <span className="cycle-label">Waktu Server (WIB)</span>
              <span className="cycle-value">
                {status.current_wib.dateStr} {status.current_wib.timeStr} WIB
              </span>
            </div>
            <div className="cycle-status-item">
              <span className="cycle-label">Hari Ini</span>
              <span className="cycle-value">
                {DAY_LABELS[status.current_wib.dayOfWeek] ??
                  status.current_wib.dayOfWeek}
              </span>
            </div>
            <div className="cycle-status-item">
              <span className="cycle-label">Minggu Siklus Aktif</span>
              <span className="cycle-value cycle-badge">
                {status.cycle_week === "WEEK_1"
                  ? "Minggu 1"
                  : status.cycle_week === "WEEK_2"
                    ? "Minggu 2"
                    : "Belum dimulai"}
              </span>
            </div>
            <div className="cycle-status-item">
              <span className="cycle-label">Hari ke- (dalam siklus)</span>
              <span className="cycle-value">
                {typeof status.cycle_day === "number"
                  ? status.cycle_day + 1
                  : "-"}
              </span>
            </div>
            <div className="cycle-status-item">
              <span className="cycle-label">Total Hari Berjalan</span>
              <span className="cycle-value">
                {typeof status.diff_days === "number" ? status.diff_days : "-"}{" "}
                hari
              </span>
            </div>
          </div>
          {typeof status.starts_in_days === "number" && (
            <p className="cycle-form-description" role="status">
              Siklus mulai dalam {status.starts_in_days} hari. Perhitungan
              minggu aktif berlaku mulai {status.cycle_start_date} WIB.
            </p>
          )}
          </>
        ) : (
          <div className="cycle-not-configured">
            <span className="cycle-warning-icon">⚠️</span>
            <p>
              <strong>Siklus belum dikonfigurasi.</strong>
            </p>
            <p>
              Sistem absensi otomatis tidak dapat berjalan tanpa tanggal mulai
              siklus. Silakan atur tanggal di bawah.
            </p>
          </div>
        )}
      </section>

      {/* Form Konfigurasi */}
      <section className="cycle-form-card">
        <h2 className="cycle-section-title">Atur Tanggal Mulai Siklus</h2>
        <p className="cycle-form-description">
          Tanggal ini akan menjadi titik awal perhitungan siklus 14 hari (Minggu
          1 dan Minggu 2). Perubahan akan tercatat dalam Audit Log.
        </p>

        {message && (
          <div
            className={`cycle-message cycle-message--${message.type}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="cycle-form">
          <div className="cycle-field">
            <label htmlFor="cycle_start_date" className="cycle-field-label">
              Tanggal Mulai Siklus (Minggu 1 Hari 1)
            </label>
            <input
              id="cycle_start_date"
              type="date"
              className="cycle-field-input"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              disabled={loading}
              required
              aria-describedby="cycle-date-hint"
            />
            <span id="cycle-date-hint" className="cycle-field-hint">
              Format: YYYY-MM-DD. Pilih hari Senin untuk konsistensi siklus
              mingguan.
            </span>
          </div>

          <div className="cycle-field">
            <label htmlFor="cycle_description" className="cycle-field-label">
              Keterangan <span className="cycle-optional">(opsional)</span>
            </label>
            <input
              id="cycle_description"
              type="text"
              className="cycle-field-input"
              placeholder="Contoh: Siklus dimulai awal semester genap"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              maxLength={200}
            />
          </div>

          <div className="cycle-form-actions">
            <button
              type="submit"
              className="cycle-submit-btn"
              disabled={loading}
            >
              {loading ? "Menyimpan..." : "Simpan Tanggal Mulai Siklus"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
