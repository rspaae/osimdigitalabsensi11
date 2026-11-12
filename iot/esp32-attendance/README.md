# ESP32 ATTENDANCE SCANNER FIRMWARE

Direktori firmware resmi perangkat pemindai RFID kehadiran OSIS & MPK SMKN 11 BANDUNG.

---

## 1. Daftar Berkas

- `esp32-attendance.ino` — Berkas utama sketsa Arduino / C++ (Visual feedback melalui LCD 16×2).
- `config.h` — Konfigurasi pinout (SPI RFID, I2C LCD) dan konstanta waktu (Tanpa alokasi Buzzer).
- `secrets.example.h` — Template kredensial Wi-Fi, endpoint backend, dan Root CA certificate.
- `secrets.h` — (*Git-ignored*) Berkas kredensial lokal pengguna. Dibuat manual dari `secrets.example.h`.

---

## 2. Persyaratan Hardware & Library

### Hardware Aktif (Project Owner Decision)
1. **ESP32 DevKit V1** (30-pin)
2. **RFID Reader RC522** (SPI: SS=5, RST=4, SCK=18, MOSI=23, MISO=19)
3. **LCD 16×2 I2C** PCF8574 (SDA=21, SCL=22, I2C Addr=0x27)
*(Buzzer dihapus sepenuhnya dari implementasi hardware saat ini).*

### Pustaka yang Dibutuhkan (Arduino IDE / PlatformIO)
1. **MFRC522** by GithubCommunity (v1.4.10 atau terbaru)
2. **LiquidCrystal_I2C** by Frank de Brabander (v1.1.2)
3. **ArduinoJson** by Benoît Blanchon (v6.21.3 atau v7.x)
4. **WiFi** & **HTTPClient** (Bawaan ESP32 Core by Espressif)

---

## 3. Petunjuk Kompilasi & Upload (Arduino IDE)

1. Buka Arduino IDE.
2. Tambahkan URL Board Manager ESP32:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Pilih Board: **ESP32 Dev Module** atau **DOIT ESP32 DEVKIT V1**.
4. Pengaturan Port & Flash:
   - Flash Frequency: 80MHz
   - Upload Speed: 921600 (atau 115200 jika kabel bermasalah)
   - Partition Scheme: Default 4MB with spiffs
5. Salin `secrets.example.h` ke `secrets.h`, lalu lengkapi isinya:
   ```c
   #define WIFI_SSID       "WIFI_SEKOLAH"
   #define WIFI_PASSWORD   "PASSWORD_WIFI"
   #define SERVER_BASE_URL "https://osis-mpk-attendance.vercel.app"
   #define DEVICE_CODE     "ESP32-LOBBY-01"
   #define DEVICE_API_KEY  "PASTE_API_KEY_DARI_BACKEND"
   ```
6. Hubungkan kabel USB dan klik **Upload**.

---

## 4. Uji koneksi lokal sebelum deploy

1. Login sebagai SUPERADMIN, buka **Dashboard → Perangkat IoT**, lalu daftarkan satu perangkat. Catat `device_code` dan salin API key yang hanya ditampilkan sekali.
2. Pastikan komputer dan ESP32 berada pada Wi-Fi yang sama. Jalankan Next.js agar bisa diakses dari jaringan lokal:
   ```powershell
   npm run dev -- --hostname 0.0.0.0
   ```
3. Cari IPv4 komputer dengan `ipconfig`, lalu di `secrets.h` gunakan `SERVER_BASE_URL` seperti `http://192.168.1.20:3000` (ganti dengan IPv4 komputer Anda). Jangan pakai `localhost`, karena alamat itu menunjuk ke ESP32 sendiri.
4. Di `secrets.h` ubah `ALLOW_LOCAL_HTTP` menjadi `1`, lalu isi SSID, password, `DEVICE_CODE`, dan `DEVICE_API_KEY`. Opsi HTTP ini hanya untuk uji di Wi-Fi tepercaya; API key dikirim tanpa enkripsi di jaringan lokal.
5. Kompilasi dan unggah sketch. Buka kembali **Dashboard → Perangkat IoT**. Dalam sekitar 15–45 detik status perangkat akan berubah menjadi **Terhubung**. Heartbeat hanya memperbarui waktu koneksi dan **tidak membuat data absensi**.
6. Sebelum produksi, ubah `ALLOW_LOCAL_HTTP` menjadi `0`, gunakan URL HTTPS Vercel, dan isi Root CA yang valid. Jangan commit `secrets.h` atau membagikan API key.

**Penting:** Menempelkan kartu memanggil endpoint absensi sungguhan dan dapat menulis data ke Railway. Record absensi tidak dapat dihapus (append-only), jadi gunakan kartu anggota yang benar saat menguji. Scan di luar jam piket tetap tercatat sebagai `DI_LUAR_JADWAL`.

## 5. Troubleshooting & Indikator Layar LCD

| Gejala / Error Code | Baris 1 LCD | Baris 2 LCD | Solusi |
|---|---|---|---|
| **Layar blank / kotak hitam** | - | - | Putar trimpot biru di belakang modul I2C untuk mengatur kontras |
| **Gagal inisialisasi SPI** | `RFID RC522 Error` | `Periksa Kabel!` | Periksa kabel SPI (VCC wajib 3.3V, SS=GPIO 5, RST=GPIO 4) |
| `DEVICE_AUTH_FAILED` | `DEVICE DITOLAK` | `Auth Key Salah` | Cek `DEVICE_API_KEY` di `secrets.h` atau lakukan rotasi key via Superadmin |
| `DEVICE_INACTIVE` | `DEVICE NONAKTIF` | `Hubungi Admin` | Aktifkan status perangkat (`is_active: true`) melalui dashboard Superadmin |
| `MEMBER_NOT_FOUND` | `KARTU DITOLAK` | `Belum Terdaftar` | Daftarkan UID kartu pada data anggota yang bersangkutan |
| `MEMBER_INACTIVE` | `ANGGOTA NONAKTIF` | `Hubungi Admin` | Periksa status keanggotaan siswa di data master |
| `CYCLE_NOT_CONFIGURED` | `SIKLUS TDK ADA` | `Set di Dashboard` | SUPERADMIN mengatur tanggal mulai siklus |
| `SCHEDULE_NO_MATCH` | `JADWAL TDK ADA` | `Cek Jam Piket` | Tidak lagi dikembalikan untuk scan di luar jam; scan kini dicatat `DI_LUAR_JADWAL`. Kode tetap ditangani firmware sebagai cadangan |
| `SCHEDULE_AMBIGUOUS` | `JADWAL BENTROK` | `Hubungi Admin` | Administrator menyelesaikan jadwal aktif yang tumpang tindih |
| `CUTOFF_TIME_EXCEEDED` | `BATAS WKT HABIS` | `Absensi Ditutup` | Tidak lagi dikembalikan; scan setelah cutoff dicatat `DI_LUAR_JADWAL`. Kode tetap ditangani firmware sebagai cadangan |
| **Network Timeout** | `KONEKSI TIMEOUT` | `Coba Lagi` | Periksa jangkauan sinyal Wi-Fi atau status konektivitas internet |

---

## 6. Checklist Validasi Perangkat Keras Fisik

Gunakan daftar uji berikut untuk memvalidasi fungsi pemindai di lapangan setelah perakitan fisik:

| No | Pengujian | Skenario Uji | Ekspektasi Tampilan LCD (16x2) | Status Pengujian |
|:--:|---|---|---|:--:|
| 1 | **Power-on & Boot** | Hubungkan kabel Micro USB 5V | `OSIS MPK 11 BDG` / `Inisialisasi...` | `[ ] NOT TESTED` |
| 2 | **LCD Initialization** | Periksa kontras & backlight | Teks terbaca jelas, kontras pas | `[ ] NOT TESTED` |
| 3 | **RC522 Detection** | SPI handshake dengan IC MFRC522 | Versi firmware terdeteksi di Serial | `[ ] NOT TESTED` |
| 4 | **Wi-Fi Connection** | Koneksi ke SSID sekolah yang disetel | `WiFi Terhubung!` / `<IP Address>` | `[ ] NOT TESTED` |
| 5 | **HTTPS Validation** | Handshake TLS dengan Root CA Vercel | Lolos SSL handshake tanpa error | `[ ] NOT TESTED` |
| 6 | **Device Authentication** | Request scan dengan API key valid | Diterima oleh backend (200 / 404 / 422) | `[ ] NOT TESTED` |
| 7 | **Registered Card** | Tempel kartu anggota terdaftar | `<Nama Anggota>` / `STATUS: HADIR` | `[ ] NOT TESTED` |
| 8 | **Unknown RFID Card** | Tempel kartu belum terdaftar | `KARTU DITOLAK` / `Belum Terdaftar` | `[ ] NOT TESTED` |
| 9 | **Duplicate Scan** | Tempel ulang kartu yang sudah absen | `<Nama Anggota>` / `SUDAH: HADIR` | `[ ] NOT TESTED` |
| 10 | **HADIR Response** | Scan pada atau sebelum cutoff dalam jadwal piket aktif | `<Nama Anggota>` / `STATUS: HADIR` | `[ ] NOT TESTED` |
| 11 | **Scan di luar jadwal** | Scan setelah cutoff atau di luar jam piket | `<Nama Anggota>` / `DI LUAR JADWAL` | `[ ] NOT TESTED` |
| 12 | **Hari tanpa jadwal** | Scan pada hari tanpa jadwal piket | `<Nama Anggota>` / `DI LUAR JADWAL` | `[ ] NOT TESTED` |
| 13 | **Wi-Fi Disconnection**| Matikan access point Wi-Fi | `Koneksi Putus!` / `Reconnecting...` | `[ ] NOT TESTED` |
| 14 | **Wi-Fi Reconnection**| Hidupkan kembali access point | `WiFi Terhubung!` / `SMKN 11 BANDUNG` | `[ ] NOT TESTED` |
| 15 | **Device Deactivation**| Set `is_active = false` di backend | `DEVICE NONAKTIF` / `Hubungi Admin` | `[ ] NOT TESTED` |

> *Catatan Pengujian: Seluruh pengujian fisik bertanda `[ ] NOT TESTED` hingga teknisi atau pengurus OSIS/MPK memverifikasi langsung menggunakan unit fisik.*
