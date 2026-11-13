# OSIS MPK SMKN 11 BANDUNG — Sistem Absensi & Manajemen

Aplikasi web + IoT untuk mengelola kehadiran, jadwal piket, dan data anggota OSIS & MPK SMKN 11 Bandung. Presensi dilakukan dengan menempelkan kartu RFID pada terminal ESP32; waktu, status, dan validasi ditentukan sepenuhnya di server.

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19
- **Bahasa:** TypeScript (`strict: true`)
- **Styling:** Tailwind CSS v4
- **Database:** PostgreSQL + Prisma 6
- **Validasi:** Zod
- **Auth:** JWT HS256 (`jose`) pada cookie sesi, bcrypt (cost 12)
- **Hardware:** ESP32 DevKit V1 + RFID RC522

Cetak biru lengkap ada di [docs/architecture.md](docs/architecture.md).

---

## 1. Fitur

### Sudah berfungsi end-to-end

| Area | Keterangan |
|---|---|
| Autentikasi & sesi | Login username/email, JWT di cookie `osis_session`, guard rute di `proxy.ts`, proteksi CSRF berbasis origin |
| RBAC | `SUPERADMIN`, `ADMIN` (scope `GENERAL`/`SECRETARY`/`DISCIPLINE_4P`/`TREASURER`), `VIEWER`; default deny, ditegakkan di server |
| Data anggota | CRUD, pencarian/filter, pemetaan UID RFID kanonikal, status `ACTIVE`/`INACTIVE`/`ALUMNI` |
| Siklus piket | Siklus 14 hari (`WEEK_1`/`WEEK_2`), tanggal mulai siklus disimpan di `SystemSetting` |
| Jadwal & roster | Jadwal piket per kegiatan/hari/minggu, penugasan roster, substitusi anggota |
| Absensi RFID | Scan kartu → verifikasi device → evaluasi waktu server WIB → `HADIR` bila di dalam jendela piket, selain itu `DI_LUAR_JADWAL` (scan tidak pernah ditolak karena waktu); idempoten terhadap scan ganda |
| Sesi otomatis | `ActivitySchedule` harian dibuat otomatis saat scan pertama, tanpa perlu buka sesi manual |
| Koreksi & audit | `PATCH /api/v1/attendance/[id]` wajib alasan ≥ 10 karakter, update + `AuditLog` dalam satu transaksi atomik. Tersedia juga UI di `/dashboard/attendance/[id]` |
| Jejak tap berulang | Scan ulang menambah `scan_count` dan memperbarui `last_scan_at`; `DI_LUAR_JADWAL` otomatis naik ke `HADIR` bila tap ulang terjadi di dalam jam piket |
| Rekonsiliasi ALPA | `POST /api/v1/schedules/[id]/reconcile` untuk sesi `CLOSED`, idempoten |
| Perangkat IoT | Registrasi device, rotasi API key (hash bcrypt, raw hanya tampil sekali), heartbeat `last_seen` |
| Dashboard | Ringkasan anggota, cakupan UID, jadwal aktif, perangkat aktif, status kesiapan scan |
| Rekap presensi | Tampilan presensi realtime per tanggal (WIB) |
| Input manual | Membuat sesi kegiatan manual (jam terisi otomatis dari jadwal piket bila ada) lalu mencatat HADIR/TERLAMBAT/IZIN/SAKIT; ALPA tetap hanya lewat rekonsiliasi |
| Kalender libur | Menandai tanggal/kegiatan yang ditiadakan; scan RFID ditolak dengan kode `ACTIVITY_CANCELLED` (LCD: “Kegiatan libur”), dashboard menampilkan pemberitahuan, dan sesi manual diblokir |
| Laporan & ekspor | Rekap kehadiran per periode (nama, kelas, jabatan, status) siap cetak A4, unduh CSV, dan unduh `.xlsx`; filter rentang tanggal, kegiatan, organisasi, dan anggota nonaktif |
| Pembaruan live | Ringkasan & rekap menyegarkan data otomatis tiap 5 detik (bisa dijeda), berhenti saat tab tidak aktif |

### Backend tersedia, UI belum ada

- Manajemen kegiatan (tambah/ubah/nonaktifkan) dari dashboard
- Penutupan sesi harian dan rekonsiliasi ALPA (API sudah ada)
- Manajemen jabatan, Sekbid, dan Komisi (API sudah lengkap)
- Manajemen akun pengguna dan penampil audit log

### Belum diimplementasikan

- Modul pelanggaran (model `Violation` sudah ada, service/API/UI belum)
- Ringkasan dashboard berbeda per role (saat ini satu tampilan dengan menu menyesuaikan role)
- Kalender laporan per tanggal pertemuan (laporan hanya merekap jumlah per status)

---

## 2. Menjalankan di lokal

### Prasyarat

- Node.js 20+
- PostgreSQL 14+ (lokal, Docker, atau Railway)

### Langkah

```bash
# 1. Dependensi (postinstall otomatis menjalankan prisma generate)
npm install

# 2. Konfigurasi environment
cp .env.example .env
# isi DATABASE_URL, AUTH_SECRET (min. 32 karakter), INITIAL_SUPERADMIN_SECRET

# 3. Terapkan skema database
npx prisma migrate deploy

# 4. Buat akun Superadmin pertama (interaktif)
npm run setup:superadmin

# 5. Jalankan aplikasi
npm run dev
```

Buka `http://localhost:3000`, login di `/login`. Cek kesehatan sistem di `/api/health`.

> `prisma migrate deploy` hanya menerapkan migrasi yang sudah ada. Jangan jalankan `prisma migrate dev` terhadap database produksi.

### Environment variables

| Nama | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | Ya | Connection string PostgreSQL. Untuk database terkelola gunakan `?sslmode=require`. |
| `AUTH_SECRET` | Ya | Secret penandatangan JWT, minimal 32 karakter. Aplikasi menolak berjalan bila kosong/terlalu pendek. |
| `INITIAL_SUPERADMIN_SECRET` | Sekali pakai | Secret untuk provisioning Superadmin pertama. Hapus/tidak dipakai lagi setelah akun dibuat. |
| `NODE_ENV` | Tidak | `development` / `production`. |

---

## 3. Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Menjalankan hasil build |
| `npm run lint` | ESLint |
| `npm test` | 148 test (9 suite, logika murni tanpa koneksi DB) |
| `npm run setup:superadmin` | Inisialisasi akun Superadmin pertama |
| `npm run import:roster` | Impor roster piket dari JSON (lihat `docs/roster-import-guide.md`) |
| `npm run import:danusan` | Impor roster Danusan 2026 (`scripts/roster-danusan-2026.json`) |
| `npm run set:week-offset` | Atur offset minggu per kegiatan (mis. `-- --activity DANUSAN --offset 1`) |

Pemeriksaan tipe: `npx tsc --noEmit`.

---

## 4. Peran pengguna

| Role | Akses |
|---|---|
| `SUPERADMIN` | Penuh: data master, perangkat, siklus, audit log, pengguna |
| `ADMIN` | Operasional harian sesuai `admin_scope`; dilarang menghapus data master dan mengakses pengaturan sistem |
| `VIEWER` | Read-only untuk pemantauan dan ekspor |

Anggota OSIS/MPK **tidak memiliki akun login**. Mereka terdaftar sebagai `Member` dan berinteraksi hanya lewat kartu RFID fisik.

---

## 5. Alur absensi RFID

1. ESP32 mengirim `POST /api/v1/attendance/scan` dengan header `Authorization: Bearer <device_key>` dan body `{ device_code, rfid_uid }`.
2. Server mengautentikasi perangkat (hash bcrypt, status aktif).
3. Server membaca waktu server dalam zona `Asia/Jakarta`, menghitung minggu siklus 14 hari, lalu mencari jadwal piket yang sedang berlangsung untuk hari itu.
4. Anggota di roster/substitusi → `HADIR`; di luar roster → `DI_LUAR_JADWAL`.
5. Scan di luar jam piket (sebelum mulai, setelah cutoff, atau hari tanpa jadwal) **tetap dicatat** sebagai `DI_LUAR_JADWAL`. Tidak ada penolakan scan yang disebabkan waktu, dan status `TERLAMBAT` tidak dihasilkan alur otomatis ini.
6. Bila hari itu tidak punya jadwal piket sama sekali, record ditempel ke kegiatan aktif pertama (`SAPA_PAGI`) dengan sesi rentang penuh hari.
7. Scan berulang pada sesi yang sama mengembalikan record awal (`is_duplicate: true`), tidak membuat duplikat.
8. Respon dikirim ke perangkat dan ditampilkan di LCD 16x2.

Detail kontrak API: [docs/attendance-api.md](docs/attendance-api.md) dan [docs/iot-device-setup.md](docs/iot-device-setup.md).

---

## 6. Struktur folder

```text
app/
  (auth)/login/        Halaman login
  dashboard/           Halaman terproteksi (ringkasan, presensi, anggota, jadwal, perangkat, siklus)
  api/v1/              Route handler REST (attendance, members, schedules, duty, devices, organisasi)
  actions/             Server Actions (auth)
lib/
  auth/                Sesi, password, RBAC, keamanan request
  db/                  Prisma client singleton
  services/            Logika domain (attendance, schedule, duty, member, device, dll.)
  validators/          Skema Zod
  utils/               Waktu WIB, siklus 14 hari, normalisasi RFID
prisma/                Schema + migrasi
iot/                   Firmware ESP32 (multi-duty & single-duty)
tests/                 Test suite (node:test + tsx)
docs/                  Dokumentasi teknis
proxy.ts               Guard rute, verifikasi sesi, proteksi CSRF
```

---

## 7. Perangkat IoT

Firmware tersedia di [iot/esp32-attendance](iot/esp32-attendance) (multi-duty) dan `iot/esp32-attendance-single` (satu kegiatan). Salin `secrets.example.h` menjadi `secrets.h` lalu isi Wi-Fi, `SERVER_BASE_URL` (HTTPS), device code, API key, dan Root CA server. `secrets.h` diabaikan Git.

Panduan lengkap: [docs/iot-device-setup.md](docs/iot-device-setup.md).

---

## 8. Dokumentasi

| Dokumen | Isi |
|---|---|
| [architecture.md](docs/architecture.md) | Cetak biru sistem, kebijakan final |
| [database-design.md](docs/database-design.md) | Skema dan relasi |
| [authentication-authorization.md](docs/authentication-authorization.md) | Sesi dan matriks RBAC |
| [attendance-api.md](docs/attendance-api.md) | Kontrak API presensi |
| [activity-schedule-api.md](docs/activity-schedule-api.md) | API kegiatan & jadwal |
| [member-organization-api.md](docs/member-organization-api.md) | API anggota & organisasi |
| [iot-device-setup.md](docs/iot-device-setup.md) | Provisioning perangkat |
| [roster-import-guide.md](docs/roster-import-guide.md) | Import roster massal |
| [schedule-exceptions.md](docs/schedule-exceptions.md) | Kalender libur & penolakan scan |
| [vercel-deployment.md](docs/vercel-deployment.md) | Deploy web |
| [vercel-railway-deployment.md](docs/vercel-railway-deployment.md) | Deploy web + database |

---

## 9. Catatan teknis

- Waktu kehadiran selalu memakai jam server (`Asia/Jakarta`). Timestamp dari ESP32 tidak dipercaya.
- `AuditLog` bersifat append-only: tidak ada endpoint update/delete.
- Satu anggota hanya boleh punya satu record per sesi (`@@unique([member_id, schedule_id])`).
- Laporan kehadiran hanya menghitung sesi `OPEN`/`CLOSED`; persentase = (`HADIR` + `TERLAMBAT`) ÷ jumlah sesi × 100, dan sesi tanpa rekaman ditampilkan pada kolom "Belum".
- Ekspor `.xlsx` dibuat langsung di server tanpa dependensi eksternal (`lib/utils/xlsx.ts`), berisi sheet `Kehadiran` (header beku + auto-filter) dan `Info` (parameter laporan).
- Presensi manual memakai jam mulai sesi sebagai `scan_time` (bukan jam input) agar rekap per tanggal tetap konsisten saat data diisi untuk tanggal sebelumnya.
- Kegiatan dapat memakai minggu siklus berbeda dari siklus global melalui `SystemSetting` `activity_week_offset:<KODE>` (`0` = ikut global, `1` = kebalikan). Saat ini `DANUSAN` diset `1` sehingga berjalan Minggu 2 ketika siklus global Minggu 1, sedangkan `SAPA_PAGI` tetap mengikuti global. Offset dipakai oleh scan RFID, dashboard, dan prefill input manual.
- Libur piket disimpan di tabel `schedule_exceptions` per tanggal/kegiatan. Scan pada tanggal libur ditolak dengan kode `ACTIVITY_CANCELLED` (tanpa membuat record) dan pembuatan sesi manual diblokir. Detail: [docs/schedule-exceptions.md](docs/schedule-exceptions.md).
- Test suite bersifat simulasi logika murni (tanpa DB), sehingga tidak menggantikan pengujian end-to-end terhadap service + database.
