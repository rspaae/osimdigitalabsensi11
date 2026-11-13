"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/utils/attendance-status";

interface MemberOption {
  id: string;
  full_name: string;
  class_grade: string | null;
  organization_type: string;
}

interface Props {
  sessionId: string;
  sessionStatus: string;
  members: MemberOption[];
}

const ALL_STATUSES = ["HADIR", "TERLAMBAT", "IZIN", "SAKIT"] as const;

export default function ManualAttendanceForm({ sessionId, sessionStatus, members }: Props) {
  const router = useRouter();

  // HADIR/TERLAMBAT ditolak server bila sesi belum OPEN; IZIN/SAKIT boleh saat tidak DRAFT.
  const allowedStatuses = useMemo(
    () => (sessionStatus === "OPEN" ? ALL_STATUSES : ALL_STATUSES.filter((status) => status === "IZIN" || status === "SAKIT")),
    [sessionStatus]
  );

  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState<string>(allowedStatuses[0] ?? "IZIN");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const haystack = `${member.full_name} ${member.class_grade ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, query]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!memberId) {
      setMessage({ type: "error", text: "Pilih anggota terlebih dahulu." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          schedule_id: sessionId,
          status,
          method: "MANUAL",
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          json?.details?.status?.[0] ??
          json?.details?.member_id?.[0] ??
          json?.details?.schedule_id?.[0] ??
          json?.error ??
          "Gagal menyimpan presensi manual.";
        setMessage({ type: "error", text: String(detail) });
        return;
      }

      setMessage({ type: "success", text: "Presensi manual tersimpan." });
      setMemberId("");
      setNotes("");
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
    <form className="manual-form manual-form--record" onSubmit={handleSubmit}>
      <div className="manual-form-grid">
        <label className="report-field manual-field-search">
          <span>Cari anggota</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nama atau kelas…"
            disabled={loading}
          />
        </label>

        <label className="report-field manual-field-member">
          <span>Anggota ({filteredMembers.length})</span>
          <select
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            disabled={loading || filteredMembers.length === 0}
            required
          >
            <option value="">Pilih anggota…</option>
            {filteredMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}{member.class_grade ? ` — ${member.class_grade}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="report-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={loading}
          >
            {allowedStatuses.map((option) => (
              <option key={option} value={option}>
                {ATTENDANCE_STATUS_LABEL[option] ?? option}
              </option>
            ))}
          </select>
        </label>

        <label className="report-field manual-field-wide">
          <span>Catatan (opsional)</span>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Contoh: surat izin dari wali kelas"
            maxLength={500}
            disabled={loading}
          />
        </label>
      </div>

      {sessionStatus !== "OPEN" ? (
        <p className="manual-hint">
          Sesi berstatus {sessionStatus}. Hanya Izin/Sakit yang dapat diinput; Hadir/Terlambat
          memerlukan sesi OPEN.
        </p>
      ) : null}

      <div className="manual-form-actions">
        <button type="submit" className="report-btn report-btn--primary" disabled={loading}>
          {loading ? "Menyimpan…" : "Simpan presensi"}
        </button>
      </div>

      {message ? (
        <p className={`manual-message is-${message.type}`} role="status">{message.text}</p>
      ) : null}
    </form>
  );
}
