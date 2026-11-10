"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface MemberFormValues {
  full_name: string;
  organization_type: "" | "OSIS" | "MPK" | "GENERAL";
  rfid_uid: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  details?: Record<string, string[]>;
}

const EMPTY_FORM: MemberFormValues = {
  full_name: "",
  organization_type: "",
  rfid_uid: "",
};

export default function MemberRegistrationForm() {
  const router = useRouter();
  const [values, setValues] = useState<MemberFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function updateField<K extends keyof MemberFormValues>(
    field: K,
    value: MemberFormValues[K]
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!values.organization_type) {
      setFeedback({ type: "error", text: "Pilih organisasi anggota." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.full_name,
          organization_type: values.organization_type,
          rfid_uid: values.rfid_uid,
        }),
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) {
        const validationMessages = Object.values(payload.details ?? {}).flat();
        const errorText = payload.error ?? validationMessages[0] ?? "Data anggota gagal disimpan.";
        setFeedback({ type: "error", text: errorText });
        return;
      }

      setValues(EMPTY_FORM);
      setFeedback({ type: "success", text: payload.message ?? "Anggota berhasil didaftarkan." });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        text: "Tidak dapat menghubungi server. Data belum dikonfirmasi tersimpan.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="member-form-card" aria-labelledby="member-form-title">
      <h2 id="member-form-title" className="cycle-section-title">Tambah Anggota</h2>
      <p className="cycle-form-description">
        Isi nama, organisasi, dan UID kartu jika tersedia. UID dapat ditambahkan nanti.
      </p>

      {feedback && (
        <div className={`cycle-message cycle-message--${feedback.type}`} role="status">
          {feedback.text}
        </div>
      )}

      <form className="member-form" onSubmit={handleSubmit}>
        <div className="member-form-grid">
          <div className="cycle-field member-field-wide">
            <label htmlFor="member-full-name" className="cycle-field-label">Nama lengkap</label>
            <input
              id="member-full-name"
              className="cycle-field-input"
              value={values.full_name}
              onChange={(event) => updateField("full_name", event.target.value)}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="cycle-field">
            <label htmlFor="member-organization" className="cycle-field-label">Organisasi</label>
            <select
              id="member-organization"
              className="cycle-field-input"
              value={values.organization_type}
              onChange={(event) => updateField("organization_type", event.target.value as MemberFormValues["organization_type"])}
              required
            >
              <option value="">Pilih organisasi</option>
              <option value="OSIS">OSIS</option>
              <option value="MPK">MPK</option>
              <option value="GENERAL">Umum</option>
            </select>
          </div>

          <div className="cycle-field member-field-wide">
            <label htmlFor="member-rfid" className="cycle-field-label">
              UID RFID <span className="cycle-optional">(opsional)</span>
            </label>
            <input
              id="member-rfid"
              className="cycle-field-input"
              value={values.rfid_uid}
              onChange={(event) => updateField("rfid_uid", event.target.value)}
              autoComplete="off"
              placeholder="Bisa ditambahkan nanti saat kartu tersedia"
            />
            <span className="cycle-field-hint">
              Sistem menormalkan format UID dan menolak UID yang sudah dipakai anggota lain.
            </span>
          </div>
        </div>

        <div className="cycle-form-actions">
          <button type="submit" className="cycle-submit-btn" disabled={saving}>
            {saving ? "Menyimpan..." : "Daftarkan Anggota"}
          </button>
        </div>
      </form>
    </section>
  );
}
