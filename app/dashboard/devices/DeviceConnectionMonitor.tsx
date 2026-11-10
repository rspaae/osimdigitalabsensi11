"use client";

import { useEffect, useState } from "react";

interface DeviceStatus {
  id: string;
  device_code: string;
  name: string;
  is_active: boolean;
  last_seen: string | null;
}

interface ApiResponse {
  devices?: DeviceStatus[];
  error?: string;
}

export default function DeviceConnectionMonitor({ initialDevices }: { initialDevices: DeviceStatus[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/v1/devices?limit=100&sort_by=name&sort_order=asc", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Status perangkat gagal diperbarui.");
        if (alive) {
          setDevices(payload.devices ?? []);
          const checked = new Date();
          setCheckedAt(checked);
          setNow(checked.getTime());
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Gagal memeriksa perangkat.");
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const isConnected = (lastSeen: string | null) => now !== null && !!lastSeen && now - new Date(lastSeen).getTime() < 45_000;

  return (
    <section className="member-list-card device-monitor" aria-labelledby="device-monitor-title">
      <div className="member-list-heading">
        <div>
          <h2 id="device-monitor-title" className="cycle-section-title">Uji koneksi ESP32</h2>
          <p className="cycle-form-description">Firmware mengirim heartbeat tiap 15 detik. Status diperbarui otomatis.</p>
        </div>
        <span className="device-monitor-refresh">{checkedAt ? "Auto-refresh · 5 dtk" : "Memeriksa…"}</span>
      </div>
      {error && <p className="device-monitor-error" role="alert">{error}</p>}
      {devices.length === 0 ? (
        <p className="member-empty-state">Daftarkan perangkat ESP32 terlebih dahulu. API key diperlukan untuk heartbeat.</p>
      ) : (
        <div className="member-table-wrap">
          <table className="member-table">
            <thead><tr><th>Kode perangkat</th><th>Status koneksi</th><th>Terakhir terlihat</th></tr></thead>
            <tbody>{devices.map((device) => {
              const connected = device.is_active && isConnected(device.last_seen);
              return (
                <tr key={device.id}>
                  <td><strong>{device.device_code}</strong><span className="device-monitor-name">{device.name}</span></td>
                  <td><span className={`device-connection-state ${connected ? "is-online" : "is-offline"}`}><i />{!device.is_active ? "Nonaktif" : connected ? "Terhubung" : "Belum terhubung"}</span></td>
                  <td>{device.last_seen ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(device.last_seen)) : "Belum pernah"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
