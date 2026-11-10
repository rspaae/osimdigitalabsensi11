# PANDUAN INTEGRASI PERANGKAT IoT & ESP32 SCANNER

Dokumentasi resmi integrasi perangkat keras IoT pemindai presensi RFID untuk Sistem Absensi & Manajemen OSIS MPK SMKN 11 BANDUNG.

---

## 1. Arsitektur & Spesifikasi Perangkat Keras

Sistem absensi fisik menggunakan mikrokontroler ESP32 DevKit V1 yang terhubung ke jaringan Wi-Fi sekolah dan berkomunikasi dengan server backend via HTTPS REST API terenkripsi.

### Keputusan Hardware (Project Owner Decision)
Berdasarkan keputusan Project Owner, perangkat keras pemindai saat ini **hanya** menggunakan 3 komponen utama berikut (dukungan buzzer telah dihapus sepenuhnya):
1. **Mikrokontroler:** ESP32 DevKit V1 (30-pin)
2. **RFID Reader:** MFRC522 (13.56 MHz RFID / MIFARE Classic / Ultralight)
3. **Display:** LCD 16×2 dengan I2C Adapter Board (PCF8574, default address `0x27`)
4. **Catu Daya:** Adaptor Micro USB 5V / 1A–2A stabil

> [!NOTE]
> Seluruh umpan balik visual (sukses, keterlambatan, duplikat, dan kode kesalahan) ditampilkan secara eksklusif melalui layar LCD 16×2. Tidak ada pin GPIO yang dialokasikan untuk buzzer.

---

## 2. Skema Pengkabelan (Pinout Diagram)

### A. RFID RC522 (Koneksi SPI)
| Pin MFRC522 | Pin ESP32 DevKit V1 | Keterangan |
|---|---|---|
| **SDA / SS** | **GPIO 5** | SPI Chip Select |
| **SCK** | **GPIO 18** | SPI Clock |
| **MOSI** | **GPIO 23** | SPI Master Out Slave In |
| **MISO** | **GPIO 19** | SPI Master In Slave Out |
| **RST** | **GPIO 4** | Reset Pin |
| **IRQ** | *Tidak Dihubungkan* | - |
| **3.3V** | **3V3** | Dilarang ke 5V (Dapat merusak RC522) |
| **GND** | **GND** | Ground |

### B. LCD 16×2 I2C (PCF8574)
| Pin LCD I2C | Pin ESP32 DevKit V1 | Keterangan |
|---|---|---|
| **SDA** | **GPIO 21** | I2C Data |
| **SCL** | **GPIO 22** | I2C Clock |
| **VCC** | **VIN (5V)** | Catu daya modul I2C & Backlight |
| **GND** | **GND** | Ground bersama |

---

## 3. Format Kanonikal RFID UID

Untuk menjamin konsistensi data antara pemindai perangkat keras, formulir admin, dan pencarian basis data:
- **Format Kanonikal:** String heksadesimal huruf besar tanpa pemisah (`0–9`, `A–F`).
- **Panjang Genap:** Setiap byte diwakili tepat 2 karakter heksadesimal (misal 4 byte = 8 hex chars, 7 byte = 14 hex chars).
- **Pembersihan Otomatis:** Karakter pemisah seperti titik dua (`:`), tanda hubung (`-`), atau spasi otomatis dihapus sebelum validasi dan penyimpanan.
- **Contoh Valid:**
  - `5C45059E`
  - `878FC201`
  - `0A1B05FF` (Byte pertama `0x0A` memiliki leading zero tetap dipertahankan)

---

## 4. Alur Registrasi Perangkat & Provisioning API Key

Untuk mencegah perangkat liar mengirim absensi palsu, setiap perangkat ESP32 harus didaftarkan oleh `SUPERADMIN`.

### Langkah Registrasi (SUPERADMIN):
1. Kirim HTTP POST request ke `/api/v1/devices`:
   ```bash
   POST /api/v1/devices
   Authorization: Cookie osis_session=<superadmin_session>
   Content-Type: application/json

   {
     "device_code": "ESP32-LOBBY-01",
     "name": "Scanner Gerbang Utama",
     "location": "Lobi Depan Sekolah"
   }
   ```
2. Respons Backend:
   ```json
   {
     "success": true,
     "message": "Perangkat berhasil didaftarkan.",
     "data": {
       "device": {
         "id": "e8d7a31b-4f92-4911-a83c-123456789abc",
         "device_code": "ESP32-LOBBY-01",
         "name": "Scanner Gerbang Utama",
         "location": "Lobi Depan Sekolah",
         "is_active": true
       },
       "raw_api_key": "9f8e7d6c5b4a3120...",
       "warning": "SIMPAN API KEY INI SEKARANG. Kunci ini tidak akan ditampilkan lagi."
     }
   }
   ```
3. **Simpan `raw_api_key`**: Backend hanya menyimpan hash `bcrypt` dari kunci tersebut. Salin nilai ini ke file `secrets.h` pada firmware.

### Rotasi API Key (Jika Key Bocor atau Terkompromi):
Kirim POST ke `/api/v1/devices/[id]/rotate-key`. Key lama otomatis tidak berlaku seketika.

---

## 5. Konfigurasi Firmware ESP32

1. Buka folder `iot/esp32-attendance/`.
2. Salin template `secrets.example.h` menjadi `secrets.h`:
   ```bash
   cp iot/esp32-attendance/secrets.example.h iot/esp32-attendance/secrets.h
   ```
3. Isi konfigurasi nyata di `secrets.h`:
   ```c
   #define WIFI_SSID       "SMKN11_HOTSPOT"
   #define WIFI_PASSWORD   "rahasia_sekolah"
   #define SERVER_BASE_URL "https://osis-mpk-attendance.vercel.app"
   #define DEVICE_CODE     "ESP32-LOBBY-01"
   #define DEVICE_API_KEY  "9f8e7d6c5b4a3120..." // raw key dari provisioning
   ```

### Konfigurasi TLS & Root CA
Firmware menerapkan verifikasi sertifikat X.509 tanpa `setInsecure()`:
```c
#define SERVER_ROOT_CA \
"-----BEGIN CERTIFICATE-----\n" \
"MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh\n" \
"... (Let's Encrypt / ISRG Root X1 pem) ...\n" \
"-----END CERTIFICATE-----\n"
```
Untuk mengunduh Root CA Vercel:
```bash
openssl s_client -showcerts -connect osis-mpk-attendance.vercel.app:443 </dev/null
```

---

## 6. Kontrak API Pemindaian (`POST /api/v1/attendance/scan`)

Endpoint ini bersifat **PUBLIC** (tidak memerlukan session cookie web) tetapi mewajibkan autentikasi Bearer API Key perangkat:

- **URL:** `POST /api/v1/attendance/scan`
- **Header:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <DEVICE_API_KEY>`
- **Body JSON:**
  ```json
  {
    "device_code": "ESP32-LOBBY-01",
    "rfid_uid": "0A1B05FF"
  }
  ```

### Tabel Respon & Perilaku Layar LCD (Maksimal 16 Karakter per Baris)
| Kasus / Error Code | HTTP Status | Tampilan Baris 1 LCD | Tampilan Baris 2 LCD | Keterangan |
|---|---|---|---|---|
| **Presensi Baru (HADIR)** | 200 OK | `Ahmad Fauzi` | `STATUS: HADIR` | Status tepat waktu dicatat |
| **Presensi Baru (TERLAMBAT)**| 200 OK | `Siti Nurhaliza` | `STATUS:TERLAMBAT` | Status terlambat dicatat |
| **Duplikat HADIR** | 200 OK | `Ahmad Fauzi` | `SUDAH: HADIR` | Status asli dipertahankan, `is_duplicate: true` |
| **Duplikat TERLAMBAT** | 200 OK | `Siti Nurhaliza` | `SUDAH: TERLAMBAT`| Status asli dipertahankan, `is_duplicate: true` |
| `DEVICE_AUTH_FAILED` | 401 Unauth | `DEVICE DITOLAK` | `Auth Key Salah` | API key salah / invalid |
| `DEVICE_INACTIVE` | 401 Unauth | `DEVICE NONAKTIF` | `Hubungi Admin` | Perangkat dinonaktifkan admin |
| `MEMBER_NOT_FOUND` | 404 Not Found| `KARTU DITOLAK` | `Belum Terdaftar` | UID tidak ada di database |
| `MEMBER_INACTIVE` | 404 Not Found| `ANGGOTA NONAKTIF` | `Hubungi Admin` | Anggota dinonaktifkan |
| `SCHEDULE_NO_OPEN` | 422 Unproc | `SESI DITUTUP` | `Tdk Ada Jadwal` | Belum ada jadwal OPEN untuk device ini |
| `SCHEDULE_AMBIGUOUS` | 422 Unproc | `JADWAL AMBIGU` | `Tutup Sesi Lain` | Ditemukan >1 sesi OPEN pada device sama |
| `VALIDATION_ERROR` | 400 Bad Req | `FORMAT SALAH` | `Cek Data Kartu` | Body atau format UID salah |
| `INTERNAL_SERVER_ERROR` | 500 Error | `SERVER ERROR` | `Hubungi Admin` | Kesalahan sistem server |
| **Network Timeout** | Client Fail | `KONEKSI TIMEOUT` | `Coba Lagi` | ESP32 gagal menghubungi server |

---

## 7. Asosiasi Perangkat & Jadwal Kegiatan

Untuk mencegah kebocoran presensi lintas kegiatan (misal scanner Danusan dipakai untuk Sapa Pagi):
1. Setiap sesi jadwal kegiatan (`ActivitySchedule`) memiliki kolom `device_id`.
2. Saat kartu dipindai, backend memfilter jadwal:
   ```sql
   WHERE status = 'OPEN' AND device_id = :device_id AND date = :today
   ```
3. Jika ditemukan **0 sesi OPEN** untuk device tersebut: Transaksi ditolak (`422 SCHEDULE_NO_OPEN`).
4. Jika ditemukan **> 1 sesi OPEN** untuk device yang sama: Transaksi ditolak (`422 SCHEDULE_AMBIGUOUS`) guna mencegah penetapan kehadiran ke sesi yang salah.
