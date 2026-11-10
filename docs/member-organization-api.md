# Dokumentasi REST API Manajemen Anggota & Struktur Organisasi
**OSIS MPK SMKN 11 BANDUNG — Attendance & Management System**
*Version: 1.0 (Milestone 10)*

Dokumen ini mendefinisikan kontrak endpoint REST API untuk pengelolaan data Anggota (Member), Jabatan (Position), Bidang OSIS (Sekbid 1–10), Komisi MPK (Komisi A–D), dan Penugasan Jabatan Anggota (MemberPosition).

---

## 1. Prinsip Keamanan & Otorisasi (RBAC)

Setiap request ke endpoint `/api/v1/*` mewajibkan:
1. **Otentikasi Sesi:** Melewati verifikasi cookie `osis_session` (Edge Middleware Proxy & Server Handler). Gagal = `401 Unauthorized`.
2. **Fresh Database Authorization:** Status `role`, `admin_scope`, dan keaktifan akun (`is_active`) diverifikasi langsung dari PostgreSQL via `requirePermission()`. Gagal = `403 Forbidden`.
3. **Pemberian Hak Akses Berdasarkan Modul:**
   - `AppModule.MEMBERS`:
     - `SUPERADMIN`: CREATE, READ, UPDATE, DELETE
     - `ADMIN (GENERAL)`: CREATE, READ, UPDATE
     - `ADMIN (SECRETARY)`: READ, UPDATE
     - `ADMIN (DISCIPLINE_4P / TREASURER)`: READ
     - `VIEWER`: READ
   - `AppModule.EXECUTIVES` (Jabatan & Penugasan):
     - `SUPERADMIN`: CREATE, READ, UPDATE, DELETE
     - `ADMIN (GENERAL)`: CREATE, READ, UPDATE
     - `ADMIN (SECRETARY)`: READ
     - `VIEWER`: READ
   - `AppModule.DIVISIONS` (Sekbid & Komisi):
     - `SUPERADMIN`: CREATE, READ, UPDATE, DELETE
     - `ADMIN (GENERAL)`: CREATE, READ, UPDATE
     - `ADMIN (SECRETARY)`: READ
     - `VIEWER`: READ

---

## 2. Manajemen Anggota (Member Management)

### A. List Anggota (Paginasi, Pencarian & Filter)
- **Endpoint:** `GET /api/v1/members`
- **Izin Diperlukan:** `AppModule.MEMBERS` -> `READ`
- **Query Parameters:**
  - `page`: nomor halaman (integer, default: 1)
  - `limit`: jumlah data per halaman (integer, default: 10, max: 100)
  - `search`: kata kunci pencarian pada NIS, NISN, atau Nama Lengkap (case-insensitive)
  - `class_grade`: filter kelas (contoh: `XII PPLG 1`)
  - `organization_type`: `OSIS` | `MPK` | `GENERAL`
  - `status`: `ACTIVE` | `INACTIVE` | `ALUMNI`
  - `sort_by`: `full_name` | `nis` | `class_grade` | `created_at` (default: `created_at`)
  - `sort_order`: `asc` | `desc` (default: `desc`)

**Contoh Response `200 OK`:**
```json
{
  "success": true,
  "members": [
    {
      "id": "e44d32d4-1a3b-45a8-9d62-d2780bb6e241",
      "nis": "22231001",
      "nisn": "0051234567",
      "full_name": "Ahmad Fauzi",
      "class_grade": "XI PPLG 2",
      "organization_type": "OSIS",
      "rfid_uid": "A1B2C3D4",
      "photo_url": null,
      "status": "ACTIVE",
      "created_at": "2026-11-08T07:30:00.000Z",
      "updated_at": "2026-11-08T07:30:00.000Z",
      "positions": [
        {
          "id": "7f8b9c0d-1234-4567-89ab-cdef01234567",
          "is_active": true,
          "position": { "id": "pos-1", "name": "Koordinator", "level": 2 },
          "sekbid": { "id": "sek-1", "number": 1, "name": "Ketaqwaan terhadap Tuhan YME" },
          "commission": null
        }
      ],
      "_count": {
        "attendances": 14,
        "violations": 0
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "total_pages": 5,
    "has_next_page": true,
    "has_prev_page": false
  }
}
```

---

### B. Detail Anggota
- **Endpoint:** `GET /api/v1/members/[id]`
- **Izin Diperlukan:** `AppModule.MEMBERS` -> `READ`
- **Deskripsi:** Mengembalikan informasi lengkap anggota, riwayat seluruh jabatan (aktif & nonaktif), 10 riwayat absensi terakhir, 10 riwayat pelanggaran terakhir, dan agregat jumlah record.

---

### C. Tambah Anggota Baru
- **Endpoint:** `POST /api/v1/members`
- **Izin Diperlukan:** `AppModule.MEMBERS` -> `CREATE`
- **Request Body (JSON):**
```json
{
  "nis": "22231099",
  "nisn": "0059876543",
  "full_name": "Siti Nurhaliza",
  "class_grade": "X AKL 1",
  "organization_type": "OSIS",
  "rfid_uid": "E5F6G7H8",
  "photo_url": null,
  "status": "ACTIVE"
}
```
- **Validasi Bisnis:**
  - `nis` wajib unik. Duplikasi menghasilkan `409 Conflict`.
  - `rfid_uid` wajib unik jika diisi. Duplikasi menghasilkan `409 Conflict`.

---

### D. Perbarui Anggota
- **Endpoint:** `PATCH /api/v1/members/[id]`
- **Izin Diperlukan:** `AppModule.MEMBERS` -> `UPDATE`
- **Request Body:** Parsial (seluruh field pada create opsional).

---

### E. Hapus / Deaktivasi Anggota
- **Endpoint:** `DELETE /api/v1/members/[id]`
- **Izin Diperlukan:** `AppModule.MEMBERS` -> `DELETE` (Hanya `SUPERADMIN`)
- **Kebijakan Integritas Historis:**
  - Jika anggota memiliki riwayat kehadiran (`attendances > 0`) atau riwayat pelanggaran (`violations > 0`), sistem **menolak hard delete** dan secara otomatis melakukan **soft deactivation** (`status: INACTIVE`, serta menonaktifkan seluruh jabatan aktifnya).
  - Jika anggota baru terdaftar dan belum memiliki riwayat kegiatan sama sekali, data dihapus secara permanen.

**Contoh Response `200 OK` (Soft Deactivated):**
```json
{
  "success": true,
  "deleted": false,
  "softDeactivated": true,
  "message": "Anggota memiliki riwayat absensi atau pelanggaran. Anggota dinonaktifkan (status INACTIVE) untuk menjaga integritas data riwayat historis."
}
```

---

## 3. Manajemen Struktur Organisasi (Positions, Sekbids, Commissions)

### A. Jabatan (Positions)
- `GET /api/v1/positions?organization_type=OSIS` (READ)
- `GET /api/v1/positions/[id]` (READ)
- `POST /api/v1/positions` (CREATE)
  ```json
  { "name": "Ketua Umum OSIS", "level": 1, "organization_type": "OSIS" }
  ```
- `PATCH /api/v1/positions/[id]` (UPDATE)
- `DELETE /api/v1/positions/[id]` (DELETE)
  - Ditolak (`422 Unprocessable Entity` / BusinessRuleError) jika jabatan masih direferensikan oleh riwayat penugasan anggota.

### B. Sekbid OSIS (Sekbids)
- `GET /api/v1/sekbids` (READ)
- `GET /api/v1/sekbids/[id]` (READ)
- `POST /api/v1/sekbids` (CREATE)
  ```json
  { "number": 1, "name": "Ketaqwaan terhadap Tuhan YME", "description": "Pembinaan rohani dan toleransi" }
  ```
- `PATCH /api/v1/sekbids/[id]` (UPDATE)
- `DELETE /api/v1/sekbids/[id]` (DELETE)
  - Ditolak jika nomor Sekbid masih digunakan pada penugasan anggota.

### C. Komisi MPK (Commissions)
- `GET /api/v1/commissions` (READ)
- `GET /api/v1/commissions/[id]` (READ)
- `POST /api/v1/commissions` (CREATE)
  ```json
  { "code": "A", "name": "Komisi A - Aspirasi & Kemitraan", "description": "Pengawasan aspirasi dan advokasi siswa" }
  ```
- `PATCH /api/v1/commissions/[id]` (UPDATE)
- `DELETE /api/v1/commissions/[id]` (DELETE)
  - Ditolak jika kode Komisi masih digunakan pada penugasan anggota.

---

## 4. Penugasan Jabatan Anggota (MemberPosition Assignment)

### A. List Penugasan
- **Endpoint:** `GET /api/v1/member-positions`
- **Query Parameters:** `member_id`, `position_id`, `sekbid_id`, `commission_id`, `period_year`, `is_active`

### B. Buat Penugasan Baru
- **Endpoint:** `POST /api/v1/member-positions`
- **Izin Diperlukan:** `AppModule.EXECUTIVES` -> `CREATE`
- **Request Body:**
```json
{
  "member_id": "e44d32d4-1a3b-45a8-9d62-d2780bb6e241",
  "position_id": "7f8b9c0d-1234-4567-89ab-cdef01234567",
  "sekbid_id": "c1d2e3f4-5678-90ab-cdef-1234567890ab",
  "commission_id": null,
  "period_year": "2025/2026",
  "is_active": true
}
```
- **Aturan Bisnis & Validasi Database:**
  1. **PostgreSQL CHECK Constraint:** `NOT (sekbid_id IS NOT NULL AND commission_id IS NOT NULL)`. Ditolak keras jika kedua field diisi bersamaan.
  2. **Scope Compatibility:** Jabatan bertipe OSIS tidak boleh diarahkan ke Komisi MPK. Jabatan bertipe MPK tidak boleh diarahkan ke Sekbid OSIS.
  3. **Unique Assignment:** `(member_id, position_id, period_year)` wajib unik. Mencegah duplikasi penugasan ganda dalam periode yang sama.

### C. Deaktivasi / Update Penugasan
- **Endpoint:** `PATCH /api/v1/member-positions/[id]`
- Untuk mendemisionerkan / menonaktifkan pengurus tanpa menghapus riwayat, kirim: `{ "is_active": false }`.

### D. Hapus Penugasan
- **Endpoint:** `DELETE /api/v1/member-positions/[id]?hard=false`
- Default melakukan soft deactivation (`is_active: false`) untuk menjaga histori kepengurusan.

---

## 5. Ringkasan Status Code HTTP

| Status Code | Kondisi |
|---|---|
| `200 OK` | Operasi pengambilan data, pembaruan, atau soft-deactivation berhasil. |
| `201 Created` | Pembuatan entitas baru berhasil disimpan ke database. |
| `400 Bad Request` | Payload request tidak valid, gagal validasi skema Zod, atau parameter salah format. |
| `401 Unauthorized` | Cookie sesi tidak ada, kedaluwarsa, atau tanda tangan kriptografis tidak sah. |
| `403 Forbidden` | Akun tidak memiliki hak akses/izin RBAC yang cukup untuk modul/aksi bersangkutan. |
| `404 Not Found` | ID entitas yang diminta tidak ditemukan di database. |
| `409 Conflict` | Pelanggaran keunikan (duplikasi NIS, duplikasi RFID UID, atau penugasan ganda di periode sama). |
| `422 Unprocessable Entity` | Pelanggaran aturan bisnis sistem (misal: menghapus master data yang masih direferensikan). |
| `500 Internal Error` | Kesalahan internal server (tanpa mengekspos rincian database atau kredensial). |
