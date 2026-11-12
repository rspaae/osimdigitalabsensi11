"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Interval pembaruan dalam milidetik. */
  intervalMs?: number;
}

function wibClock(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(11, 19);
}

/**
 * Menyegarkan data server secara berkala agar halaman terasa live.
 * Berhenti otomatis saat tab tidak terlihat, dan bisa dijeda manual.
 * State komponen klien (mis. isian filter) tidak hilang karena memakai router.refresh().
 */
export default function LiveRefresh({ intervalMs = 5000 }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
    setLastUpdated(wibClock());
  }, [router]);

  useEffect(() => {
    if (paused) return;

    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const timer = window.setInterval(tick, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [paused, intervalMs, refresh]);

  return (
    <span className="live-pill" role="status">
      <span className={`live-dot ${paused ? "" : "is-on"}`} aria-hidden="true" />
      <span className="live-text">
        {paused ? "Live dijeda" : "Live"}
        {!paused && lastUpdated ? ` · ${lastUpdated} WIB` : ""}
      </span>
      <button
        type="button"
        className="live-toggle"
        onClick={() => setPaused((value) => !value)}
        aria-label={
          paused ? "Lanjutkan pembaruan otomatis" : "Jeda pembaruan otomatis"
        }
      >
        {paused ? "Lanjutkan" : "Jeda"}
      </button>
    </span>
  );
}
