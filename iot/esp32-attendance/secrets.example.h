// secrets.example.h — TEMPLATE KONFIGURASI ESP32 OSIS MPK ATTENDANCE
//
// CARA PENGGUNAAN:
//   1. Salin file ini sebagai "secrets.h" di direktori yang sama.
//   2. Isi setiap nilai dengan kredensial nyata.
//   3. secrets.h sudah masuk .gitignore — JANGAN commit secrets.h ke repository.
//   4. JANGAN pernah mengisi nilai nyata di file secrets.example.h ini.
//
// CATATAN KEAMANAN:
//   - DEVICE_API_KEY diperoleh dari endpoint POST /api/v1/devices saat registrasi.
//   - API key HANYA ditampilkan sekali oleh backend. Simpan baik-baik.
//   - Gunakan Wi-Fi jaringan sekolah yang terpercaya.
//   - Jangan bagikan secrets.h melalui chat, email, atau cloud storage tanpa enkripsi.

#ifndef SECRETS_H
#define SECRETS_H

// ── Wi-Fi ──────────────────────────────────────────────────────────────────
#define WIFI_SSID       "nama-wifi-sekolah"
#define WIFI_PASSWORD   "password-wifi-sekolah"

// ── Backend API ───────────────────────────────────────────────────────────
// Untuk uji lokal: http://IP-KOMPUTER-ANDA:3000 (komputer dan ESP32 satu Wi-Fi).
// Untuk produksi: URL HTTPS Vercel, contoh https://osis-mpk-attendance.vercel.app
#define SERVER_BASE_URL "https://your-app.vercel.app"

// HANYA untuk uji lokal pada Wi-Fi tepercaya yang terisolasi.
// Ubah ke 1 di secrets.h saat SERVER_BASE_URL memakai http://; produksi harus 0.
#define ALLOW_LOCAL_HTTP 0

// ── Device Credentials ────────────────────────────────────────────────────
// device_code: Kode unik perangkat sesuai database (huruf besar, misal "ESP32-HALL-01")
#define DEVICE_CODE     "ESP32-DEVICE-CODE"

// raw API key yang diperoleh saat POST /api/v1/devices (hanya tampil sekali)
#define DEVICE_API_KEY  "your-48-character-hex-api-key-here"

// ── TLS Certificate ───────────────────────────────────────────────────────
// Root CA certificate untuk validasi TLS ke Vercel.
// Vercel menggunakan sertifikat dari Let's Encrypt atau DigiCert.
// Perbarui jika sertifikat root CA berubah.
// Lihat docs/iot-device-setup.md untuk petunjuk mendapatkan sertifikat.
//
// Untuk mendapatkan sertifikat:
//   openssl s_client -connect your-app.vercel.app:443 -showcerts
// Salin bagian "-----BEGIN CERTIFICATE-----" dari root CA (bukan leaf cert).
#define SERVER_ROOT_CA \
"-----BEGIN CERTIFICATE-----\n" \
"PASTE_YOUR_ROOT_CA_CERTIFICATE_HERE\n" \
"-----END CERTIFICATE-----\n"

#endif // SECRETS_H
