# Dokumentasi REST API Manajemen Kegiatan & Jadwal Sesi Presensi
**OSIS MPK SMKN 11 BANDUNG — Attendance & Management System**
*Version: 1.0 (Milestone 11)*

Dokumen ini mendefinisikan spesifikasi resmi endpoint REST API untuk manajemen Kegiatan (`Activity`) dan Jadwal Sesi Presensi (`ActivitySchedule`), aturan konversi zona waktu (WIB ke UTC), state machine transisi status sesi, serta penegakan hak akses berbasis role (RBAC).

---

## 1. Kebijakan Keamanan & Hak Akses (RBAC)

Setiap request ke `/api/v1/activities/*` dan `/api/v1/schedules/*` mewajibkan:
1. **Otentikasi Sesi:** Melewati verifikasi cookie `osis_session` di edge proxy middleware (`proxy.ts`). Gagal = `401 Unauthorized`.
2. **Fresh DB Authorization:** Status akun, role, dan scope divalidasi langsung terhadap data pengguna PostgreSQL terkini (`requirePermission()`). Gagal = `403 Forbidden`.

### Matriks Akses Peran:
- **`AppModule.ACTIVITIES` (Manajemen Master Kegiatan):**
  - `SUPERADMIN`: CREATE, READ, UPDATE, DELETE
  - `ADMIN (GENERAL)`: CREATE, READ, UPDATE (DELETE dilarang)
  - `ADMIN (SECRETARY, DISCIPLINE_4P, TREASURER)`: READ only
  - `VIEWER`: READ only
- **`AppModule.SCHEDULES` (Manajemen Jadwal Sesi Presensi):**
  - `SUPERADMIN`: CREATE, READ, UPDATE, DELETE, MANAGE_SESSION
  - `ADMIN (GENERAL)`: CREATE, READ, UPDATE, MANAGE_SESSION
  - `ADMIN (SECRETARY)`: CREATE, READ, UPDATE, MANAGE_SESSION
  - `ADMIN (TREASURER)`: CREATE, READ, UPDATE, MANAGE_SESSION
  - `ADMIN (DISCIPLINE_4P)`: READ only
  - `VIEWER`: READ only

---

## 2. Manajemen Kegiatan (Activity Management)

Kegiatan utama yang telah terdaftar dalam sistem:
1. **Sapa Pagi (`SAPA_PAGI`)**: Kegiatan piket rutin penyambutan siswa di gerbang sekolah (tipe: `ROUTINE`, default late: 15 menit).
2. **Danusan (`DANUSAN`)**: Kegiatan piket operasional pencarian dana usaha/kewirausahaan (tipe: `ROUTINE`, default late: 15 menit).
3. **Nyisir 4P (`NYISIR_4P`)**: Patroli pagi penertiban tata tertib & pelanggaran siswa (tipe: `ROUTINE`, default late: 15 menit).

### A. List Kegiatan
- **Endpoint:** `GET /api/v1/activities`
- **Izin Diperlukan:** `AppModule.ACTIVITIES` -> `READ`
- **Query Parameters:**
  - `page`: nomor halaman (integer, default: 1)
  - `limit`: jumlah item per halaman (integer, default: 10, max: 100)
  - `search`: pencarian pada nama, kode, atau deskripsi kegiatan
  - `type`: `ROUTINE` | `SPECIAL`
  - `is_active`: `true` | `false`
  - `sort_by`: `name` | `code` | `created_at` (default: `created_at`)
  - `sort_order`: `asc` | `desc` (default: `desc`)

**Contoh Response `200 OK`:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "code": "SAPA_PAGI",
      "name": "Sapa Pagi",
      "type": "ROUTINE",
      "description": "Piket penyambutan siswa pagi hari di gerbang utama SMKN 11 Bandung",
      "default_late_threshold_minutes": 15,
      "is_active": true,
      "created_at": "2026-11-08T00:00:00.000Z",
      "updated_at": "2026-11-08T00:00:00.000Z",
      "_count": {
        "schedules": 45
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "total_pages": 1,
    "has_next_page": false,
    "has_prev_page": false
  }
}
```

### B. Tambah Kegiatan Baru
- **Endpoint:** `POST /api/v1/activities`
- **Izin Diperlukan:** `AppModule.ACTIVITIES` -> `CREATE`
- **Request Body (JSON):**
```json
{
  "code": "RAPAT_PLENO",
  "name": "Rapat Pleno Pengurus",
  "type": "SPECIAL",
  "description": "Rapat koordinasi bulanan seluruh pengurus OSIS dan MPK",
  "default_late_threshold_minutes": 10,
  "is_active": true
}
```

### C. Detail Kegiatan
- **Endpoint:** `GET /api/v1/activities/[id]`
- **Izin Diperlukan:** `AppModule.ACTIVITIES` -> `READ`
- Mengembalikan data kegiatan beserta 10 jadwal sesi terakhir.

### D. Perbarui Kegiatan
- **Endpoint:** `PATCH /api/v1/activities/[id]`
- **Izin Diperlukan:** `AppModule.ACTIVITIES` -> `UPDATE`
- Perubahan nilai `default_late_threshold_minutes` pada master kegiatan **tidak mengubah** jadwal sesi yang sudah dibuat sebelumnya (prinsip zero silent retroactive change).

### E. Hapus Kegiatan
- **Endpoint:** `DELETE /api/v1/activities/[id]`
- **Izin Diperlukan:** `AppModule.ACTIVITIES` -> `DELETE` (Hanya `SUPERADMIN`)
- **Proteksi Integritas:** Ditolak (`422 Unprocessable Entity`) jika kegiatan masih memiliki riwayat jadwal sesi (`schedules > 0`).

---

## 3. Manajemen Jadwal Sesi Presensi (Activity Schedules)

### A. Format Waktu & Penanganan Zona Waktu (WIB ke UTC)
1. **Tanggal (`date`):**
   - Format: `YYYY-MM-DD` (contoh: `2026-11-08`).
   - Disimpan pada kolom PostgreSQL `@db.Date` sebagai UTC midnight (`2026-11-08T00:00:00.000Z`).
2. **Titik Waktu (`start_time`, `late_threshold`, `end_time`):**
   - Format Input Fleksibel:
     * Waktu lokal WIB: `06:30` (otomatis dikombinasikan dengan `date`).
     * ISO String dengan offset: `2026-11-08T06:30:00+07:00`.
   - Konversi Otomatis ke UTC:
     * `06:30 WIB` pada tanggal `2026-11-08` dikonversi menjadi `2026-11-07T23:30:00.000Z` (dikurangi offset 7 jam).
   - PostgreSQL Native Mapping: Disimpan sebagai `TIMESTAMPTZ` (UTC ISO 8601).
3. **Validasi Kronologis Waktu:**
   - Wajib memenuhi: $\text{start\_time} < \text{late\_threshold} < \text{end\_time}$.
   - Pelanggaran urutan ditolak dengan `400 Bad Request`.

---

### B. State Machine Status Jadwal Sesi
Sistem mengimplementasikan siklus hidup sesi yang ketat:
- **`DRAFT`:** Sesi disiapkan, belum dapat menerima scan presensi RFID dari perangkat scanner.
- **`OPEN`:** Sesi dibuka aktif oleh pengurus. Perangkat scanner ESP32 dapat mengirim scan kehadiran dan membandingkan waktu server terhadap `late_threshold`.
- **`CLOSED`:** Sesi ditutup. Perangkat scanner menolak scan kartu baru. Sesi terkunci untuk tahap audit dan rekonsiliasi data ALPA.

**Aturan Transisi Status:**
- `DRAFT` $\rightarrow$ `OPEN`: Diizinkan (Buka sesi presensi).
- `DRAFT` $\rightarrow$ `CLOSED`: Diizinkan (Batalkan sesi tanpa kehadiran).
- `OPEN` $\rightarrow$ `CLOSED`: Diizinkan (Tutup sesi presensi).
- `OPEN` $\rightarrow$ `DRAFT`: **Ditolak** (Sesi yang telah berjalan tidak boleh kembali ke draf).
- `CLOSED` $\rightarrow$ `OPEN` / `DRAFT`: **Ditolak Keras** (Sesi tertutup terkunci permanen).

---

### C. Endpoint Jadwal Sesi

#### 1. List Jadwal Sesi
- **Endpoint:** `GET /api/v1/schedules`
- **Izin Diperlukan:** `AppModule.SCHEDULES` -> `READ`
- **Query Parameters:** `page`, `limit`, `activity_id`, `date`, `status`, `sort_by`, `sort_order`

#### 2. Buat Jadwal Sesi Baru
- **Endpoint:** `POST /api/v1/schedules`
- **Izin Diperlukan:** `AppModule.SCHEDULES` -> `CREATE`
- **Request Body (JSON):**
```json
{
  "activity_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "device_id": null,
  "title": "Sapa Pagi Gerbang Utama",
  "date": "2026-11-08",
  "start_time": "06:30",
  "late_threshold": "06:45",
  "end_time": "07:15",
  "status": "DRAFT"
}
```

#### 3. Buka / Tutup / Perbarui Sesi
- **Endpoint:** `PATCH /api/v1/schedules/[id]`
- **Izin Diperlukan:**
  - Jika mengubah status (buka/tutup sesi): `AppModule.SCHEDULES` -> `MANAGE_SESSION`
  - Jika mengubah informasi sesi: `AppModule.SCHEDULES` -> `UPDATE`
- **Buka Sesi:** `{ "status": "OPEN" }`
- **Tutup Sesi:** `{ "status": "CLOSED" }`

#### 4. Hapus Jadwal Sesi
- **Endpoint:** `DELETE /api/v1/schedules/[id]`
- **Izin Diperlukan:** `AppModule.SCHEDULES` -> `DELETE` (Hanya `SUPERADMIN`)
- **Proteksi Integritas:** Ditolak (`422 Unprocessable Entity`) jika jadwal sesi sudah memiliki riwayat presensi anggota (`attendances > 0`).

---

## 4. Contoh Error Responses

### Format Error Validasi Zod (`400 Bad Request`):
```json
{
  "error": "Validasi data gagal.",
  "details": {
    "date": ["Format tanggal harus YYYY-MM-DD (contoh: 2026-11-08)."]
  }
}
```

### Format Error Aturan Bisnis (`422 Unprocessable Entity`):
```json
{
  "error": "Sesi yang telah ditutup (CLOSED) terkunci dan tidak dapat dibuka atau diubah statusnya kembali."
}
```

### Format Error Otorisasi (`403 Forbidden`):
```json
{
  "error": "Akses ditolak: Akun ADMIN (DISCIPLINE_4P) tidak memiliki izin CREATE pada modul SCHEDULES."
}
```
