# Database Design & PostgreSQL Schema Specification
**OSIS MPK SMKN 11 BANDUNG — Attendance & Management System**
*Version: 1.1 (Task 03.1 Refinement & Review)*

Dokumen ini merupakan spesifikasi rancangan basis data resmi untuk PostgreSQL yang diimplementasikan menggunakan Prisma ORM pada file [`prisma/schema.prisma`](file:///c:/Users/rafar/OneDrive/Dokumen/osis-mpk-attendance/prisma/schema.prisma).

---

## 1. Entity Relationship Diagram (ERD)

Diagram berikut merepresentasikan seluruh entitas, atribut kunci, dan relasi relasional dalam sistem:

```mermaid
erDiagram
    users ||--o| members : "member_id (1:1 opt)"
    users ||--o{ audit_logs : "user_id (1:N)"
    users ||--o{ violations : "reported_by (1:N)"
    
    members ||--o{ member_positions : "member_id (1:N)"
    members ||--o{ attendances : "member_id (1:N)"
    members ||--o{ violations : "member_id (1:N)"
    
    positions ||--o{ member_positions : "position_id (1:N)"
    sekbids ||--o{ member_positions : "sekbid_id (1:N opt)"
    commissions ||--o{ member_positions : "commission_id (1:N opt)"
    
    activities ||--o{ activity_schedules : "activity_id (1:N)"
    devices ||--o{ activity_schedules : "device_id (1:N opt)"
    
    activity_schedules ||--o{ attendances : "schedule_id (1:N)"

    users {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        enum role
        enum admin_scope
        uuid member_id FK,UK "opt"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    members {
        uuid id PK
        string nis UK
        string nisn
        string full_name
        string class_grade
        enum organization_type
        string rfid_uid UK "opt"
        string photo_url
        enum status
        timestamp created_at
        timestamp updated_at
    }

    positions {
        uuid id PK
        string name UK
        int level
        enum organization_type
        timestamp created_at
        timestamp updated_at
    }

    member_positions {
        uuid id PK
        uuid member_id FK
        uuid position_id FK
        uuid sekbid_id FK "opt"
        uuid commission_id FK "opt"
        string period_year
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    sekbids {
        uuid id PK
        int number UK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }

    commissions {
        uuid id PK
        string code UK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }

    activities {
        uuid id PK
        string code UK
        string name
        enum type
        string description
        int default_late_threshold_minutes
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    activity_schedules {
        uuid id PK
        uuid activity_id FK
        uuid device_id FK "opt"
        string title
        date date
        timestamp start_time
        timestamp late_threshold
        timestamp end_time
        enum status
        timestamp created_at
        timestamp updated_at
    }

    attendances {
        uuid id PK
        uuid member_id FK
        uuid schedule_id FK
        timestamp scan_time
        enum status
        enum method
        string notes
        timestamp created_at
        timestamp updated_at
    }

    violations {
        uuid id PK
        uuid member_id FK
        string category
        string description
        date date
        string sanction
        enum status
        uuid reported_by FK
        timestamp resolved_at
        timestamp created_at
        timestamp updated_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        string action
        string entity_type
        string entity_id
        json old_values
        json new_values
        string reason
        string ip_address
        string user_agent
        timestamp created_at
    }

    devices {
        uuid id PK
        string device_code UK
        string name
        string location
        string api_key_hash
        timestamp last_seen
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    system_settings {
        uuid id PK
        string key UK
        string value
        string description
        timestamp created_at
        timestamp updated_at
    }
```

---

## 2. Penjelasan Tabel & Definisi Kolom

### 2.1. Tabel `users`
Menyimpan akun pengguna login antarmuka web (SUPERADMIN, ADMIN, VIEWER). Siswa umum (ANGGOTA) tidak dibuatkan akun login di tabel ini.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier unik akun pengguna |
| `username` | VARCHAR(255) | No | Username login unik |
| `email` | VARCHAR(255) | No | Alamat email unik untuk pemulihan dan notifikasi |
| `password_hash` | VARCHAR(255) | No | Hashed password (Argon2id/bcrypt) |
| `role` | ENUM `Role` | No | Nilai: `SUPERADMIN`, `ADMIN`, `VIEWER` |
| `admin_scope` | ENUM `AdminScope` | Yes | Lingkup tugas admin: `GENERAL`, `SECRETARY`, `DISCIPLINE_4P`, `TREASURER` |
| `member_id` | UUID (FK, UK) | Yes | Relasi 1:1 opsional ke tabel `members` (jika pengurus juga siswa anggota) |
| `is_active` | BOOLEAN | No | Status aktif akun (default: `true`) |
| `created_at` | TIMESTAMP | No | Waktu pendaftaran akun |
| `updated_at` | TIMESTAMP | No | Waktu modifikasi profil akun |

### 2.2. Tabel `members`
Basis data induk seluruh siswa pengurus OSIS dan perwakilan MPK yang memiliki kartu RFID fisik.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier unik anggota |
| `nis` | VARCHAR(50) | No | Nomor Induk Siswa (Wajib, Unik) |
| `nisn` | VARCHAR(50) | Yes | Nomor Induk Siswa Nasional (Opsional) |
| `full_name` | VARCHAR(255) | No | Nama lengkap siswa sesuai dapodik |
| `class_grade` | VARCHAR(50) | No | Kelas/tingkat siswa (misal: "X PPLG 1") |
| `organization_type`| ENUM `OrganizationType`| No | Organisasi: `OSIS`, `MPK` |
| `rfid_uid` | VARCHAR(100) | Yes | UID kartu fisik RFID (Unik jika terdaftar) |
| `photo_url` | VARCHAR(500) | Yes | URL pas foto formal anggota |
| `status` | ENUM `MemberStatus` | No | Status: `ACTIVE`, `INACTIVE`, `ALUMNI` (default: `ACTIVE`) |
| `created_at` | TIMESTAMP | No | Waktu pencatatan data anggota |
| `updated_at` | TIMESTAMP | No | Waktu perbaruan data anggota |

### 2.3. Tabel `positions` (Jabatan)
Master jabatan formal organisasi (Ketua, Sekretaris, Bendahara, Ketua Sekbid, dll.).

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier unik jabatan |
| `name` | VARCHAR(100) | No | Nama jabatan unik |
| `level` | INTEGER | No | Tingkat hierarki (1: Pimpinan Inti, 2: Koordinator, 3: Anggota) |
| `organization_type`| ENUM `OrganizationType`| No | Lingkup organisasi: `OSIS`, `MPK`, `GENERAL` |
| `created_at` | TIMESTAMP | No | Waktu dibuat |
| `updated_at` | TIMESTAMP | No | Waktu diupdate |

### 2.4. Tabel `member_positions`
Pencatatan riwayat penugasan jabatan siswa per periode kepengurusan.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier penugasan |
| `member_id` | UUID (FK) | No | Anggota yang ditugaskan |
| `position_id` | UUID (FK) | No | Jabatan yang diemban |
| `sekbid_id` | UUID (FK) | Yes | Relasi ke Sekbid (jika pengurus OSIS) |
| `commission_id` | UUID (FK) | Yes | Relasi ke Komisi (jika perwakilan MPK) |
| `period_year` | VARCHAR(20) | No | Masa bakti (misal: "2025/2026") |
| `is_active` | BOOLEAN | No | Status keaktifan jabatan saat ini (default: `true`) |
| `created_at` | TIMESTAMP | No | Waktu pencatatan penugasan |
| `updated_at` | TIMESTAMP | No | Waktu perubahan penugasan |

### 2.5. Tabel `sekbids` (Seksi Bidang OSIS)
Daftar resmi Seksi Bidang 1 s.d. 10 pada OSIS SMKN 11 Bandung.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier unik Sekbid |
| `number` | INTEGER | No | Nomor sekbid unik (1-10) |
| `name` | VARCHAR(150) | No | Nama Sekbid (misal: "Ketaqwaan terhadap Tuhan YME") |
| `description` | TEXT | Yes | Uraian tugas pokok dan program kerja |
| `created_at` | TIMESTAMP | No | Waktu dibuat |
| `updated_at` | TIMESTAMP | No | Waktu diupdate |

### 2.6. Tabel `commissions` (Komisi MPK)
Daftar resmi Komisi A s.d. D pada MPK SMKN 11 Bandung.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier unik Komisi |
| `code` | VARCHAR(10) | No | Kode komisi unik (`A`, `B`, `C`, `D`) |
| `name` | VARCHAR(150) | No | Nama Komisi (misal: "Komisi Kedisiplinan & Aspirasi") |
| `description` | TEXT | Yes | Tupoksi pengawasan komisi |
| `created_at` | TIMESTAMP | No | Waktu dibuat |
| `updated_at` | TIMESTAMP | No | Waktu diupdate |

### 2.7. Tabel `activities` (Master Kegiatan)
Master jenis kegiatan presensi resmi organisasi.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier kegiatan |
| `code` | VARCHAR(50) | No | Kode kegiatan unik (`SAPA_PAGI`, `DANUSAN`, `NYISIR_4P`) |
| `name` | VARCHAR(150) | No | Nama lengkap kegiatan |
| `type` | ENUM `ActivityType` | No | Jenis: `ROUTINE`, `SPECIAL` |
| `description` | TEXT | Yes | Uraian kegiatan |
| `default_late_threshold_minutes` | INTEGER | No | Default menit batas toleransi saat pembuatan sesi baru (default: `15`) |
| `is_active` | BOOLEAN | No | Status aktif kegiatan (default: `true`) |
| `created_at` | TIMESTAMP | No | Waktu dibuat |
| `updated_at` | TIMESTAMP | No | Waktu diupdate |

### 2.8. Tabel `activity_schedules` (Sesi Absensi)
Setiap baris merepresentasikan **satu sesi absensi yang memiliki identitas unik** pada tanggal tertentu.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier sesi unik |
| `activity_id` | UUID (FK) | No | Jenis kegiatan yang diselenggarakan |
| `device_id` | UUID (FK) | Yes | Terminal scanner yang ditugaskan |
| `title` | VARCHAR(200) | Yes | Judul sesi (misal: "Sapa Pagi Gerbang Utama 10 Nov") |
| `date` | DATE | No | Tanggal kalender sesi (@db.Date) |
| `start_time` | TIMESTAMP | No | Timestamp lengkap waktu scanner mulai menerima kartu |
| `late_threshold`| TIMESTAMP | No | Timestamp lengkap batas waktu toleransi (lewat dari jam ini = TERLAMBAT) |
| `end_time` | TIMESTAMP | No | Timestamp lengkap waktu sesi ditutup (setelah ini scan ditolak) |
| `status` | ENUM `ScheduleStatus`| No | Status sesi: `DRAFT`, `OPEN`, `CLOSED` (default: `DRAFT`) |
| `created_at` | TIMESTAMP | No | Waktu pembukaan sesi |
| `updated_at` | TIMESTAMP | No | Waktu pembaruan sesi |

### 2.9. Tabel `attendances` (Presensi Siswa)
Transaksi pencatatan kehadiran anggota per sesi kegiatan.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier transaksi presensi |
| `member_id` | UUID (FK) | No | Siswa yang hadir/absen |
| `schedule_id` | UUID (FK) | No | Sesi kegiatan yang diikuti |
| `scan_time` | TIMESTAMP | No | Waktu presensi dicatat (**menggunakan waktu server**) |
| `status` | ENUM `AttendanceStatus` | No | Status: `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPA` |
| `method` | ENUM `AttendanceMethod` | No | Metode pencatatan: `RFID`, `MANUAL` (default: `RFID`) |
| `notes` | TEXT | Yes | Catatan tambahan / dispensasi |
| `created_at` | TIMESTAMP | No | Waktu insert baris |
| `updated_at` | TIMESTAMP | No | Waktu koreksi status |

### 2.10. Tabel `violations` (Pelanggaran & Sanksi)
Pencatatan pelanggaran tata tertib dan ketidakhadiran anggota.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier pelanggaran |
| `member_id` | UUID (FK) | No | Siswa pelanggar |
| `category` | VARCHAR(100) | No | Kategori (misal: "Keterlambatan Berulang", "Atribut 4P") |
| `description` | TEXT | No | Uraian kronologis pelanggaran |
| `date` | DATE | No | Tanggal terjadinya pelanggaran |
| `sanction` | VARCHAR(255) | Yes | Bentuk sanksi/tugas pembinaan yang diberikan |
| `status` | ENUM `ViolationStatus`| No | Status penyelesaian: `PENDING`, `RESOLVED` |
| `reported_by` | UUID (FK) | No | ID akun User (Pengurus) pelapor |
| `resolved_at` | TIMESTAMP | Yes | Waktu penyelesaian sanksi |
| `created_at` | TIMESTAMP | No | Waktu pencatatan laporan |
| `updated_at` | TIMESTAMP | No | Waktu pembaharuan status sanksi |

### 2.11. Tabel `audit_logs`
Rekam jejak mutasi data sensitif (terutama koreksi absensi). Bersifat **append-only** (hanya `INSERT`, tidak ada `UPDATE` atau `DELETE`).

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier log audit |
| `user_id` | UUID (FK) | No | Pengguna yang melakukan mutasi |
| `action` | VARCHAR(100) | No | Kode aksi (misal: `ATTENDANCE_CORRECTION`) |
| `entity_type` | VARCHAR(100) | No | Nama entitas yang diubah (`Attendance`, `Member`) |
| `entity_id` | VARCHAR(100) | No | ID entitas yang mengalami mutasi |
| `old_values` | JSONB | Yes | Nilai data sebelum mutasi dalam format JSON |
| `new_values` | JSONB | Yes | Nilai data sesudah mutasi dalam format JSON |
| `reason` | TEXT | No | Alasan mutasi yang wajib diisi oleh pengguna |
| `ip_address` | VARCHAR(50) | Yes | Alamat IP pengakses |
| `user_agent` | TEXT | Yes | Informasi browser/perangkat pengakses |
| `created_at` | TIMESTAMP | No | Waktu pencatatan log (default: `now()`) |

### 2.12. Tabel `devices` (Terminal Scanner ESP32)
Otentikasi perangkat keras scanner terminal.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier perangkat |
| `device_code` | VARCHAR(50) | No | Kode unik terminal (misal: `ESP32-GATE-01`) |
| `name` | VARCHAR(150) | No | Nama terminal scanner |
| `location` | VARCHAR(150) | No | Lokasi fisik (misal: "Gerbang Depan SMKN 11") |
| `api_key_hash`| VARCHAR(255) | No | Hash SHA-256 / bcrypt dari Device API Key (**bukan plaintext**) |
| `last_seen` | TIMESTAMP | Yes | Waktu terakhir heartbeat/transmisi diterima |
| `is_active` | BOOLEAN | No | Status aktif terminal (default: `true`) |
| `created_at` | TIMESTAMP | No | Waktu pendaftaran perangkat |
| `updated_at` | TIMESTAMP | No | Waktu pembaruan data/rotasi key |

### 2.13. Tabel `system_settings`
Konfigurasi global platform berbasis key-value.

| Kolom | Tipe Data | Nullable | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | UUID (PK) | No | Identifier setting |
| `key` | VARCHAR(100) | No | Kunci pengaturan unik (misal: `ACTIVE_ACADEMIC_YEAR`) |
| `value` | TEXT | No | Nilai konfigurasi |
| `description` | VARCHAR(255) | Yes | Deskripsi fungsi konfigurasi |
| `created_at` | TIMESTAMP | No | Waktu dibuat |
| `updated_at` | TIMESTAMP | No | Waktu diupdate |

---

## 3. Unique Constraints & Index Strategy

### 3.1. Unique Constraints
1. **Presensi Tunggal Per Anggota Per Sesi:**
   - `@@unique([member_id, schedule_id])` pada tabel `attendances`. Menjamin satu siswa hanya bisa memiliki tepat satu record kehadiran pada satu sesi kegiatan, mencegah scan berulang.
2. **Kredensial User:**
   - `@unique` pada `users.username` dan `users.email`.
   - `@unique` pada `users.member_id` (relasi 1:1 opsional).
3. **Identitas Siswa & Kartu:**
   - `@unique` pada `members.nis`.
   - `@unique` pada `members.rfid_uid` (UID kartu RFID bersifat unik di antara seluruh anggota).
4. **Struktur Organisasi & Master Data:**
   - `@unique([member_id, position_id, period_year])` pada `member_positions`.
   - `@unique` pada `positions.name`.
   - `@unique` pada `sekbids.number` (angka 1 sampai 10).
   - `@unique` pada `commissions.code` (A, B, C, D).
   - `@unique` pada `activities.code` (`SAPA_PAGI`, `DANUSAN`, `NYISIR_4P`).
   - `@unique` pada `devices.device_code` (`ESP32-GATE-01`).
   - `@unique` pada `system_settings.key`.

### 3.2. Index Strategy
Index ditambahkan secara strategis untuk mengoptimalkan performa query pencarian dan agregasi tanpa membebani write throughput:
- `users`: `[role]`, `[is_active]` (Mempercepat filter otorisasi dan middleware sesi).
- `members`: `[status]`, `[organization_type]`, `[class_grade]`, `[rfid_uid]` (Pencarian instan saat scan RFID di-ingest).
- `member_positions`: `[period_year]`, `[is_active]` (Filter pengurus aktif per tahun ajaran).
- `activities`: `[is_active]`, `[type]`.
- `activity_schedules`: `[date]`, `[status]`, `[activity_id, date]` (Pencarian cepat sesi yang sedang OPEN pada hari ini).
- `attendances`: `[schedule_id, status]`, `[member_id, status]`, `[scan_time]` (Optimalisasi live count scanner dan rekapitulasi data).
- `violations`: `[member_id, status]`, `[date]`.
- `audit_logs`: `[entity_type, entity_id]`, `[user_id]`, `[action]`, `[created_at]` (Pelacakan kronologis jejak audit mutasi).
- `devices`: `[is_active]`, `[device_code]` (Validasi cepat header request ESP32).

---

## 4. Delete Behavior & Data Integrity Rules

| Relasi | Parent -> Child | On Delete | Justifikasi Integritas |
| :--- | :--- | :---: | :--- |
| `Member -> Attendance` | Member -> Attendances | **RESTRICT** | Riwayat kehadiran siswa **tidak boleh hilang/terhapus** meskipun anggota menjadi nonaktif atau alumni. Siswa yang memiliki record presensi tidak boleh dihapus dari database. |
| `Schedule -> Attendance` | ActivitySchedule -> Attendances | **RESTRICT** | Sesi absensi yang sudah memiliki riwayat presensi tidak boleh dihapus secara tidak sengaja. |
| `Activity -> Schedule` | Activity -> Schedules | **RESTRICT** | Master jenis kegiatan tidak boleh dihapus jika sudah memiliki jadwal sesi pelaksanaan. |
| `Member -> MemberPosition` | Member -> Positions | **RESTRICT** | Riwayat jabatan siswa di masa lalu tidak boleh terhapus. |
| `User -> AuditLog` | User -> AuditLogs | **RESTRICT** | Jejak audit mutasi sistem bersifat permanen dan tidak boleh menjadi *orphan* tanpa pemilik akun. |
| `User -> Member` | User -> Member | **SET NULL** | Jika akun login web dihapus/dicabut haknya, profil data `Member` siswa tetap utuh. |
| `Device -> Schedule` | Device -> Schedules | **SET NULL** | Jika perangkat scanner dicopot/diganti, jadwal kegiatan tetap tersimpan dengan `device_id` null. |
| `Sekbid/Commission -> MemberPosition`| Divisi -> Penugasan | **SET NULL** | Jika struktur bidang disesuaikan, record penugasan pengurus tetap bertahan. |

---

## 5. ADMIN Permission Scope Design & Access Mapping

### 5.1. Definisi Scope Tanggung Jawab
`AdminScope` pada model `User` adalah enum statis yang merepresentasikan **lingkup tanggung jawab fungsional pengurus** (bukan dynamic permission engine atau per-user ACL). Ini menjamin bahwa akun dengan role `ADMIN`:
1. Tidak otomatis memiliki akses penuh setara `SUPERADMIN`.
2. Dibatasi secara ketat hanya pada modul yang sesuai dengan tugasnya.
3. Tetap type-safe dan tidak memerlukan tabel izin dinamis yang rumit.

### 5.2. Matriks Hak Akses Modul Berdasarkan Scope

| Modul Aplikasi | SUPERADMIN | ADMIN (GENERAL) | ADMIN (SECRETARY) | ADMIN (DISCIPLINE_4P) | ADMIN (TREASURER) | VIEWER (Pembina) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Auth & Sesi Akun** | Full | Akun Pribadi | Akun Pribadi | Akun Pribadi | Akun Pribadi | Akun Pribadi |
| **2. Dashboard** | System Full | Operasional | Operasional | Operasional (Disiplin)| Operasional (Danusan)| Read-Only Agregat |
| **3. Manajemen Anggota** | C, R, U, D | C, R, U | R, U (Kontak/RFID) | R | R | R (Read-Only) |
| **4. Manajemen Pengurus** | C, R, U, D | C, R, U | R | R | R | R (Read-Only) |
| **5. Sekbid & Komisi** | C, R, U, D | C, R, U | R | R | R | R (Read-Only) |
| **6. Manajemen Kegiatan** | C, R, U, D | C, R, U | R | R | R | R (Read-Only) |
| **7. Jadwal Sesi Kegiatan** | C, R, U, D | C, R, U, Buka/Tutup | C, R, U, Buka/Tutup | R | C, R, U (Danusan only)| R (Read-Only) |
| **8. Absensi (Live/Input)**| C, R, U, D | R, Input Manual | R, Input Izin/Sakit | R (Live Monitor) | R (Live Danusan) | R (Live Monitor) |
| **9. Riwayat & Koreksi** | R, Koreksi + Audit| R, Koreksi + Audit | R, Koreksi + Audit | R | R | R (Read-Only) |
| **10. Pelanggaran** | C, R, U, D | C, R, U | R | C, R, U, Tindak Lanjut| R | R (Read-Only) |
| **11. Laporan & Rekapitulasi**| R, Rekap, Export | R, Rekap, Export | R, Rekap ALPA, Export | R, Export (Disiplin) | R, Export (Danusan) | R, Export |
| **12. Pengaturan Sistem** | Full | **NO ACCESS** | **NO ACCESS** | **NO ACCESS** | **NO ACCESS** | **NO ACCESS** |
| **13. Integrasi IoT** | C, R, U, D | R (Monitor Status)| **NO ACCESS** | **NO ACCESS** | **NO ACCESS** | **NO ACCESS** |

---

## 6. ActivitySchedule Time Design & Timezone Handling

### 6.1. Representasi Kolom Waktu
Pada model `ActivitySchedule`:
- `date`: `DateTime @db.Date`
  - Menyimpan tanggal murni (YYYY-MM-DD) tanpa komponen waktu atau zona waktu.
  - Digunakan untuk pengelompokan kalender harian, filter pencarian per tanggal, dan composite index `[activity_id, date]`.
- `start_time`, `late_threshold`, `end_time`: `DateTime` (PostgreSQL `TIMESTAMPTZ` / `TIMESTAMP WITH TIME ZONE`)
  - Menyimpan titik waktu absolut (UTC ISO 8601).
  - Merupakan gabungan tanggal pelaksanaan dan jam/menit operasional yang telah dikonversi ke UTC.

### 6.2. Semantik & Interpretasi Backend
1. **Konversi Zona Waktu:**
   - Seluruh waktu diinput oleh pengurus dalam waktu lokal Indonesia Barat (**WIB / Asia/Jakarta, UTC+7**).
   - Backend Next.js bertugas mengonversi jam lokal WIB ke UTC sebelum disimpan ke database (misal: Sapa Pagi jam 06:30 WIB disimpan sebagai `06:30 - 7 jam = 23:30 UTC` hari sebelumnya).
2. **Evaluasi Kehadiran yang Aman dan Bebas Ambigu:**
   - Pada model `Attendance`, `scan_time` menggunakan waktu server: `DateTime @default(now())` (UTC timestamp).
   - Pengecekan status kehadiran dilakukan secara murni matematis antar timestamp UTC:
     ```typescript
     // 1. Validasi sesi aktif
     const isSessionActive =
       schedule.status === "OPEN" &&
       serverTime >= schedule.start_time &&
       serverTime <= schedule.end_time;

     // 2. Evaluasi status keterlambatan
     const status =
       serverTime <= schedule.late_threshold
         ? AttendanceStatus.HADIR
         : AttendanceStatus.TERLAMBAT;
     ```
   - **Keuntungan:** Tidak ada kalkulasi string parsing yang rentan saat request RFID masuk, tidak ada masalah pergeseran tanggal/pergantian hari, dan perbandingan waktu sepenuhnya seragam pada tingkat epoch millisecond.

---

## 7. Late Threshold Business Rules

1. **Preset Template:** `Activity.default_late_threshold_minutes` berfungsi sebagai nilai default (preset) saat form pembuatan sesi baru dibuka (misal: Sapa Pagi default 15 menit).
2. **Final Threshold Per Sesi:** Nilai `ActivitySchedule.late_threshold` dihitung dan disimpan sebagai timestamp mandiri saat sesi dijadwalkan:
   $$\text{late\_threshold} = \text{start\_time} + \text{threshold\_minutes}$$
   Pengurus dapat menyesuaikan toleransi ini secara manual untuk sesi tertentu (misal: hari hujan diberi toleransi 25 menit) tanpa mengubah master activity.
3. **Immutabilitas Sesi Berjalan:** Mengubah nilai `default_late_threshold_minutes` pada master `Activity` **TIDAK AKAN** mengubah jadwal sesi (`ActivitySchedule`) yang sudah dibuat sebelumnya. Hal ini mencegah mutasi data historis secara tidak sengaja (*zero silent retroactive change*).
4. **Trusted Server Time:** Evaluasi status kehadiran murni membandingkan `late_threshold` sesi terhadap waktu server/database `now()`. Timestamp dari perangkat scanner ESP32 sama sekali tidak dipercayai untuk kalkulasi status.

---

## 8. MemberPosition Integrity Rules (`sekbid_id` & `commission_id`)

### 8.1. Aturan Bisnis Relasi Divisi
Struktur kepengurusan memiliki 3 skenario penugasan:
1. **Pengurus Sekbid OSIS:** Wajib memiliki `sekbid_id` dan `commission_id` harus `NULL`.
2. **Perwakilan Komisi MPK:** Wajib memiliki `commission_id` dan `sekbid_id` harus `NULL`.
3. **Pimpinan Inti (BPH / Presidium):** Ketua Umum, Sekretaris Umum, dan Bendahara Umum tidak terikat pada satu divisi, sehingga kedua kolom (`sekbid_id` dan `commission_id`) bernilai `NULL`.
4. **Larangan Multidivisi:** Seorang anggota **TIDAK BOLEH** secara bersamaan memiliki `sekbid_id` dan `commission_id` dalam satu penugasan:
   $$\neg (\text{sekbid\_id} \neq \text{NULL} \land \text{commission\_id} \neq \text{NULL})$$

### 8.2. Penegakan Integritas Data
- **Application-Level Validation (Zod):**
  Ditegakkan pada validator Server Actions / API (`lib/validators/member.schema.ts`):
  ```typescript
  export const memberPositionSchema = z.object({
    member_id: z.string().uuid(),
    position_id: z.string().uuid(),
    sekbid_id: z.string().uuid().nullable().optional(),
    commission_id: z.string().uuid().nullable().optional(),
    period_year: z.string().regex(/^\d{4}\/\d{4}$/),
  }).refine(
    (data) => !(data.sekbid_id && data.commission_id),
    {
      message: "Jabatan tidak boleh terikat pada Sekbid dan Komisi secara bersamaan.",
      path: ["commission_id"],
    }
  );
  ```
- **Database-Level Constraint (SQL Migration):**
  Saat migrasi PostgreSQL dieksekusi, constraint CHECK ditambahkan:
  ```sql
  ALTER TABLE "member_positions"
  ADD CONSTRAINT "chk_member_position_division"
  CHECK (NOT (sekbid_id IS NOT NULL AND commission_id IS NOT NULL));
  ```

---

## 9. Member Identity Fields (`nis` vs `nisn`)

1. **`nis` (Nomor Induk Siswa):**
   - **Karakteristik:** `VARCHAR(50)`, `NOT NULL`, `@unique`.
   - **Tujuan:** Merupakan nomor identitas resmi internal yang diterbitkan oleh SMKN 11 Bandung. Berfungsi sebagai primary identifier siswa di lingkungan sekolah, basis pencarian data pengurus, dan kunci relasi utama.
2. **`nisn` (Nomor Induk Siswa Nasional):**
   - **Karakteristik:** `VARCHAR(50)`, `NULLABLE`.
   - **Tujuan:** Merupakan nomor induk nasional terpusat dari Kemendikbudristek.
   - **Alasan Tetap Bersifat Opsional:**
     - Siswa baru tingkat X sering kali mengalami keterlambatan verifikasi data Dapodik pusat atau perbaikan nomor ganda saat mutasi.
     - Operasional harian absensi RFID di sekolah tidak bergantung pada NISN.
     - Menjadikan NISN wajib berisiko memblokir pendaftaran anggota baru yang kartu atau data nasionalnya sedang dalam proses penerbitan.

---

## 10. Prisma Client Singleton Implementation

Prisma Client dikonfigurasi melalui singleton pattern di [`lib/db/prisma.ts`](file:///c:/Users/rafar/OneDrive/Dokumen/osis-mpk-attendance/lib/db/prisma.ts) untuk mencegah koneksi ganda akibat Hot Module Replacement (HMR) pada mode development Next.js:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

---

## 11. Environment Variables & Setup

- **File Template:** [`.env.example`](file:///c:/Users/rafar/OneDrive/Dokumen/osis-mpk-attendance/.env.example)
- **Konfigurasi Lokal:** [`.env`](file:///c:/Users/rafar/OneDrive/Dokumen/osis-mpk-attendance/.env) (Terproteksi pada `.gitignore`)
- **Format URL Database:**
  ```env
  DATABASE_URL="postgresql://user:password@localhost:5432/osis_mpk_attendance?schema=public"
  NODE_ENV="development"
  ```
