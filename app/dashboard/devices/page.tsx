import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreshUser } from "@/lib/auth/context";
import { getDevices } from "@/lib/services/device.service";
import { deviceQuerySchema } from "@/lib/validators/device.schema";
import DeviceRegistrationForm from "./DeviceRegistrationForm";
import DeviceConnectionMonitor from "./DeviceConnectionMonitor";

export const instant = false;

export const metadata: Metadata = {
  title: "Perangkat IoT | OSIS MPK SMKN 11 BANDUNG",
};

export default async function DevicesPage() {
  const user = await getFreshUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/dashboard");

  const result = await getDevices(deviceQuerySchema.parse({ page: 1, limit: 100, sort_by: "name", sort_order: "asc" }));

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Perangkat IoT</span>
        </nav>
        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Perangkat IoT</h1>
          <span className="settings-role-badge">SUPERADMIN</span>
        </div>
        <p className="settings-page-desc">Daftarkan ESP32, salin kredensialnya ke firmware, lalu pantau heartbeat untuk memastikan perangkat mencapai server.</p>
      </header>
      <div className="settings-page-body">
        <DeviceRegistrationForm />
        <section className="member-list-card device-test-guide" aria-labelledby="device-test-guide-title">
          <h2 id="device-test-guide-title" className="cycle-section-title">Cara uji koneksi lokal</h2>
          <ol>
            <li>Jalankan web dengan <code>npm run dev -- --hostname 0.0.0.0</code> saat komputer dan ESP32 terhubung ke Wi-Fi yang sama.</li>
            <li>Di <code>iot/esp32-attendance/secrets.h</code>, isi URL <code>http://IP-KOMPUTER:3000</code>, kode perangkat, API key, dan set <code>ALLOW_LOCAL_HTTP 1</code>.</li>
            <li>Unggah sketch. Heartbeat akan dikirim tiap 15 detik; status di bawah diperbarui otomatis.</li>
          </ol>
          <p className="device-test-warning">Gunakan HTTP hanya di jaringan Wi-Fi tepercaya. Heartbeat tidak membuat absensi; menempelkan kartu akan memanggil API absensi sungguhan.</p>
        </section>
        <DeviceConnectionMonitor initialDevices={result.devices.map((device) => ({
          id: device.id,
          device_code: device.device_code,
          name: device.name,
          is_active: device.is_active,
          last_seen: device.last_seen?.toISOString() ?? null,
        }))} />
      </div>
    </main>
  );
}
