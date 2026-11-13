"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  label: string;
}

export default function DeleteExceptionButton({ id, label }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Hapus status libur untuk ${label}? Jadwal akan kembali normal.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/schedule-exceptions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        setError(json?.error ?? "Gagal menghapus.");
        return;
      }
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="exception-delete">
      <button
        type="button"
        className="member-text-button"
        onClick={handleDelete}
        disabled={loading}
      >
        {loading ? "Menghapus…" : "Hapus"}
      </button>
      {error ? <span className="exception-delete-error">{error}</span> : null}
    </span>
  );
}
