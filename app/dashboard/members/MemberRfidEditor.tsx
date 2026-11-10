"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Props {
  memberId: string;
  currentUid: string | null;
  memberName: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
}

export default function MemberRfidEditor({ memberId, currentUid, memberName }: Props) {
  const router = useRouter();
  const [uid, setUid] = useState(currentUid ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/v1/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid_uid: uid.trim() || null }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "UID kartu gagal disimpan.");
      setFeedback(payload.message ?? "UID tersimpan.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "UID kartu gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="member-rfid-editor" onSubmit={save} aria-label={`UID RFID ${memberName}`}>
      <input
        className="cycle-field-input member-rfid-input"
        value={uid}
        onChange={(event) => setUid(event.target.value)}
        placeholder="Belum diisi"
        autoComplete="off"
        aria-label={`UID RFID ${memberName}`}
      />
      <button type="submit" className="member-rfid-save" disabled={saving}>
        {saving ? "Menyimpan…" : "Simpan"}
      </button>
      {feedback && <span className="member-rfid-feedback" role="status">{feedback}</span>}
    </form>
  );
}
