"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ATTENDANCE_STATUS_OPTIONS } from "@/lib/utils/attendance-status";

interface Props {
  attendanceId: string;
  currentStatus: string;
  currentNotes: string | null;
}

export default function CorrectionForm({
  attendanceId,
  currentStatus,
  currentNotes,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (reason.trim().length < 10) {
      setMessage({
        type: "error",
        text: "Alasan koreksi wajib diisi minimal 10 karakter.",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/attendance/${attendanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason: reason.trim(),
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          json?.details?.status?.[0] ??
          json?.details?.reason?.[0] ??
          json?.error ??
          "Gagal menyimpan koreksi.";
        setMessage({ type: "error", text: String(detail) });
        return;
      }

      setMessage({
        type: "success",
        text: "Koreksi tersimpan dan tercatat di audit log.",
      });
      setReason("");
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
    <form onSubmit={handleSubmit} className="cycle-form">
      {message && (
        <div
          className={`cycle-message cycle-message--${message.type}`}
          role="alert"
        >
          {message.text}
        </div>
      )}

      <div className="cycle-field">
        <label htmlFor="correction-status" className="cycle-field-label">
          Status baru
        </label>
        <select
          id="correction-status"
          className="cycle-field-input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={loading}
        >
          {ATTENDANCE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="cycle-field-hint">
          Status saat ini: {currentStatus}. Memilih status yang sama tetap dicatat
          sebagai koreksi.
        </span>
      </div>

      <div className="cycle-field">
        <label htmlFor="correction-reason" className="cycle-field-label">
          Alasan koreksi (wajib, minimal 10 karakter)
        </label>
        <textarea
          id="correction-reason"
          className="cycle-field-input correction-textarea"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={loading}
          required
          minLength={10}
          maxLength={500}
          placeholder="Contoh: siswa menyerahkan surat izin sakit dari orang tua"
        />
      </div>

      <div className="cycle-field">
        <label htmlFor="correction-notes" className="cycle-field-label">
          Catatan tambahan <span className="cycle-optional">(opsional)</span>
        </label>
        <textarea
          id="correction-notes"
          className="cycle-field-input correction-textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={loading}
          maxLength={500}
          placeholder="Kosongkan bila tidak ada catatan tambahan"
        />
      </div>

      <div className="cycle-form-actions">
        <button type="submit" className="cycle-submit-btn" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Koreksi"}
        </button>
        <Link
          href="/dashboard/attendance"
          className="member-secondary-link correction-back"
        >
          Batal &amp; kembali
        </Link>
      </div>
    </form>
  );
}
