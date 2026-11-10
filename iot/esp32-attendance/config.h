// config.h — Konfigurasi pin dan parameter sistem ESP32 OSIS MPK Attendance
// File ini AMAN untuk di-commit ke repository (tidak ada credential).
// Untuk credential Wi-Fi dan API Key, gunakan secrets.h (tidak di-commit).
//
// CATATAN PERANGKAT KERAS (PROJECT OWNER DECISION):
// Perangkat keras HANYA terdiri dari:
// 1. ESP32 DevKit V1 (30-pin)
// 2. MFRC522 RFID Reader (SPI)
// 3. LCD 16x2 I2C PCF8574 (I2C)
// TIDAK ADA ALOKASI PIN BUZZER (Dihapus sepenuhnya sesuai keputusan Project Owner).
// Seluruh umpan balik ditampilkan melalui LCD 16x2.

#ifndef CONFIG_H
#define CONFIG_H

// ── RFID RC522 — Koneksi SPI ──────────────────────────────────────────────
#define RFID_SS_PIN     5    // SDA/SS
#define RFID_RST_PIN    4    // RST
// SPI shared pins bawaan hardware ESP32:
// SCK  → GPIO 18
// MOSI → GPIO 23
// MISO → GPIO 19

// ── LCD 16x2 I2C (PCF8574) ───────────────────────────────────────────────
#define LCD_I2C_ADDR    0x27 // Alamat I2C default PCF8574
#define LCD_COLS        16
#define LCD_ROWS        2
// I2C shared pins bawaan hardware ESP32:
// SDA  → GPIO 21
// SCL  → GPIO 22

// ── API Endpoint ──────────────────────────────────────────────────────────
#define API_SCAN_PATH   "/api/v1/attendance/scan"
#define API_HEARTBEAT_PATH "/api/v1/devices/heartbeat"

// ── Timing & Behavior ────────────────────────────────────────────────────
#define WIFI_TIMEOUT_MS         15000  // Waktu maksimum koneksi Wi-Fi (15 detik)
#define HTTP_TIMEOUT_MS         10000  // Timeout HTTP request (10 detik)
#define SCAN_COOLDOWN_MS        3000   // Delay setelah scan berhasil (3 detik)
#define CARD_REMOVAL_DELAY_MS   1500   // Waktu tunggu deteksi kartu diangkat (1.5 detik)
#define WIFI_RECONNECT_DELAY_MS 5000   // Delay antar percobaan reconnect Wi-Fi (5 detik)
#define MAX_HTTP_RETRIES        2      // Maksimum retry HTTP sebelum menyerah
#define HEARTBEAT_INTERVAL_MS   15000  // Periksa koneksi perangkat tiap 15 detik

// ── UID Normalization ─────────────────────────────────────────────────────
// Backend menerima UID dalam format HEX UPPERCASE tanpa pemisah (misal: "0A1B05FF")
// Firmware wajib menormalisasi sebelum dikirim.

#endif // CONFIG_H
