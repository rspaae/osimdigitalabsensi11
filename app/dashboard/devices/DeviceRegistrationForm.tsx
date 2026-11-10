"use client";

import { useState, type FormEvent } from "react";

interface DeviceFormValues {
  device_code: string;
  name: string;
  location: string;
}

interface CreatedDevice {
  device: { device_code: string; name: string; location: string };
  raw_api_key: string;
  warning: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
  data?: CreatedDevice;
}

const EMPTY_FORM: DeviceFormValues = { device_code: "", name: "", location: "" };

export default function DeviceRegistrationForm() {
  const [values, setValues] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<CreatedDevice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setCreated(null);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Perangkat gagal didaftarkan.");
      setCreated(payload.data);
      setValues(EMPTY_FORM);
      setMessage(payload.message ?? "Perangkat berhasil didaftarkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Perangkat gagal didaftarkan.");
    } finally {
      setSaving(false);
    }
  }

  async function copyKey() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.raw_api_key);
      setMessage("API key disalin. Simpan di secrets.h lokal; key ini hanya tampil sekali.");
    } catch {
      setMessage("Clipboard tidak tersedia. Salin key yang tampil lalu simpan di secrets.h lokal.");
    }
  }

  return (
    <section className="member-form-card" aria-labelledby="device-form-title">
      <h2 id="device-form-title" className="cycle-section-title">Daftarkan ESP32</h2>
      <p className="cycle-form-description">
        API key dibuat hanya setelah formulir dikirim dan hanya ditampilkan sekali.
      </p>
      {message && <div className="cycle-message cycle-message--success" role="status">{message}</div>}
      <form className="member-form" onSubmit={submit}>
        <div className="member-form-grid">
          <div className="cycle-field">
            <label htmlFor="device-code" className="cycle-field-label">Kode perangkat</label>
            <input id="device-code" className="cycle-field-input" value={values.device_code} onChange={(e) => setValues({ ...values, device_code: e.target.value })} placeholder="ESP32-LOBBY-01" minLength={3} maxLength={100} required />
          </div>
          <div className="cycle-field">
            <label htmlFor="device-name" className="cycle-field-label">Nama perangkat</label>
            <input id="device-name" className="cycle-field-input" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="Scanner Sapa Pagi" minLength={2} maxLength={100} required />
          </div>
          <div className="cycle-field member-field-wide">
            <label htmlFor="device-location" className="cycle-field-label">Lokasi</label>
            <input id="device-location" className="cycle-field-input" value={values.location} onChange={(e) => setValues({ ...values, location: e.target.value })} placeholder="Gerbang sekolah" minLength={2} maxLength={200} required />
          </div>
        </div>
        <div className="cycle-form-actions">
          <button type="submit" className="cycle-submit-btn" disabled={saving}>{saving ? "Mendaftarkan…" : "Buat perangkat & API key"}</button>
        </div>
      </form>
      {created && (
        <div className="device-key-panel" role="alert">
          <strong>{created.device.device_code} — API key baru</strong>
          <code className="device-key-value">{created.raw_api_key}</code>
          <p>{created.warning}</p>
          <button type="button" className="member-rfid-save" onClick={copyKey}>Salin API key</button>
          <p className="cycle-field-hint">Jangan kirim key ke chat atau commit ke Git. Masukkan ke secrets.h yang diabaikan Git.</p>
        </div>
      )}
    </section>
  );
}
