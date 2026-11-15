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
          <div className="ui-stats-grid" style={{ marginBottom: "20px" }}>
            <div className="ui-stat-card is-mint">
              <span className="ui-stat-label">Minggu Siklus Aktif</span>
              <div className="ui-stat-value" style={{ fontSize: "20px" }}>
                {status.cycle_week === "WEEK_1"
                  ? "Minggu 1"
                  : status.cycle_week === "WEEK_2"
                    ? "Minggu 2"
                    : "Belum dimulai"}
              </div>
              <span className="ui-stat-sub">Rotasi 14 hari</span>
            </div>

            <div className="ui-stat-card is-sky">
              <span className="ui-stat-label">Tanggal Mulai Siklus</span>
              <div className="ui-stat-value" style={{ fontSize: "18px" }}>
                {status.cycle_start_date}
              </div>
              <span className="ui-stat-sub">Titik awal (W1H1)</span>
            </div>

            <div className="ui-stat-card is-indigo">
              <span className="ui-stat-label">Hari Ini (WIB)</span>
              <div className="ui-stat-value" style={{ fontSize: "18px" }}>
                {DAY_LABELS[status.current_wib.dayOfWeek] ?? status.current_wib.dayOfWeek}
              </div>
              <span className="ui-stat-sub">
                {status.current_wib.dateStr} · {status.current_wib.timeStr} WIB
              </span>
            </div>

            <div className="ui-stat-card is-amber">
              <span className="ui-stat-label">Hari Ke- (Dalam Siklus)</span>
              <div className="ui-stat-value" style={{ fontSize: "20px" }}>
                {typeof status.cycle_day === "number" ? status.cycle_day + 1 : "-"}
                <small style={{ fontSize: "14px", fontWeight: "normal", color: "var(--text-secondary)" }}> / 14</small>
              </div>
              <span className="ui-stat-sub">
                Total {typeof status.diff_days === "number" ? status.diff_days : "-"} hari berjalan
              </span>
            </div>
          </div>

          {typeof status.starts_in_days === "number" && (
            <p className="cycle-form-description" role="status" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: "8px", color: "#166534" }}>
              ℹ️ Siklus mulai dalam {status.starts_in_days} hari. Perhitungan
              minggu aktif berlaku mulai {status.cycle_start_date} WIB.
            </p>
          )}
          </>
        ) : (
          <div className="ui-empty-card" style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
            <div className="ui-empty-icon" aria-hidden="true">⚠️</div>
            <p className="ui-empty-title" style={{ color: "#92400e" }}>Siklus Belum Dikonfigurasi</p>
            <p className="ui-empty-desc" style={{ color: "#b45309" }}>
              Sistem absensi otomatis tidak dapat berjalan tanpa tanggal mulai siklus. Silakan atur tanggal mulai siklus di bawah.
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
