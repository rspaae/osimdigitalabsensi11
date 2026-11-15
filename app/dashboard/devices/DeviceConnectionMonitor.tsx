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

  function getDeviceInitials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase();
  }

  return (
    <section className="member-list-card device-monitor" aria-labelledby="device-monitor-title">
      <div className="member-list-heading">
        <div>
          <h2 id="device-monitor-title" className="cycle-section-title">Uji koneksi ESP32</h2>
          <p className="cycle-form-description">Firmware mengirim heartbeat tiap 15 detik. Status diperbarui otomatis.</p>
        </div>
        <span className="ui-live-pill" aria-live="polite">
          <span className="ui-pulse-dot" aria-hidden="true" />
          {checkedAt ? "Live · 5 dtk" : "Memeriksa…"}
        </span>
      </div>

      {error && <p className="device-monitor-error" role="alert">{error}</p>}

      {devices.length === 0 ? (
        <div className="ui-empty-card">
          <div className="ui-empty-icon" aria-hidden="true">📡</div>
          <p className="ui-empty-title">Belum ada perangkat</p>
          <p className="ui-empty-desc">Daftarkan perangkat ESP32 terlebih dahulu. API key diperlukan untuk heartbeat.</p>
        </div>
      ) : (
        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>Perangkat</th>
                <th>Status koneksi</th>
                <th>Terakhir terlihat</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const connected = device.is_active && isConnected(device.last_seen);
                return (
                  <tr key={device.id}>
                    <td>
                      <div className="device-row-identity">
                        <span className="ui-avatar device-avatar" aria-hidden="true">
                          {getDeviceInitials(device.name)}
                        </span>
                        <div>
                          <strong className="device-code-label">{device.device_code}</strong>
                          <span className="device-monitor-name">{device.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`device-connection-state ${connected ? "is-online" : "is-offline"}`}>
                        <i />
                        {!device.is_active ? "Nonaktif" : connected ? "Terhubung" : "Belum terhubung"}
                      </span>
                    </td>
                    <td>
                      {device.last_seen
                        ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(device.last_seen))
                        : "Belum pernah"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
