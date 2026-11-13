# Panduan Import Roster Sapa Pagi

## Ringkasan

Roster resmi Sapa Pagi tersimpan di `scripts/roster-sapa-pagi.json` dan berisi 74 penugasan Week 1/Week 2, Senin–Jumat. SUPERADMIN dapat menyiapkan jadwal dan menghubungkan roster dari halaman dashboard. Script `scripts/import-roster.ts` tetap tersedia untuk proses batch melalui terminal.

## Alur melalui Dashboard

1. Daftarkan anggota dari **Dashboard → Data Anggota** dengan nama dan organisasi (OSIS/MPK). NIS, NISN, dan kelas opsional; UID RFID boleh ditambahkan kemudian.
2. Buka **Dashboard → Jadwal & Roster**.
3. Atur jam mulai (default `05:30` WIB sesuai contoh jadwal) lalu pilih **Siapkan Kegiatan & Jadwal yang Belum Ada**. Halaman membuat kegiatan `SAPA_PAGI` jika belum tersedia dan jadwal Week 1/Week 2 untuk Senin–Jumat yang belum ada. Cutoff Sapa Pagi adalah `06:00` WIB.
4. Periksa jumlah nama yang cocok. Halaman hanya mencocokkan nama lengkap secara persis (tanpa fuzzy matching) dan memeriksa OSIS/MPK. Nama ganda, organisasi berbeda, dan anggota nonaktif tidak otomatis dipilih.
5. Pilih **Hubungkan semua nama yang cocok**. Proses ini menambahkan penugasan yang belum ada dan aman diulang; roster lama tidak dihapus.
6. Setelah UID kartu tersedia, isi dan simpan di kolom RFID pada **Dashboard → Data Anggota**.
7. Daftarkan ESP32 dari **Dashboard → Perangkat IoT**. API key tampil sekali; simpan hanya di `iot/esp32-attendance/secrets.h` lokal dan jangan commit atau kirim melalui chat.

Jika tanggal siklus belum disetel, atur dari **Dashboard → Pengaturan Siklus** sebelum mencoba scan RFID.

---

## Prasyarat

Sebelum menjalankan script import, pastikan semua langkah berikut telah selesai:

### 1. Aktivitas tersedia di database

Aktivitas Sapa Pagi harus sudah dibuat dengan kode `SAPA_PAGI`:

```
POST /api/v1/activities
{
  "name": "Sapa Pagi",
  "code": "SAPA_PAGI",
  "description": "Kegiatan penyambutan pagi hari OSIS MPK"
}
```

### 2. DutySchedule untuk setiap kombinasi Week/Day telah dibuat

Buat jadwal piket untuk **Minggu 1** dan **Minggu 2**, hari **Senin–Jumat** (10 jadwal total):

```
POST /api/v1/duty/schedules
{
  "activity_id": "<id_sapa_pagi>",
  "cycle_week": "WEEK_1",
  "day_of_week": "MONDAY",
  "start_time_wib": "05:30",
  "cutoff_time_wib": "06:00",
  "title": "Sapa Pagi Minggu 1 - Senin"
}
```

Ulangi untuk setiap kombinasi `cycle_week` × `day_of_week`.

### 3. Data anggota sudah ada di database

Anggota harus sudah terdaftar. Script **tidak membuat anggota baru**.

### 4. Tanggal mulai siklus sudah dikonfigurasi

SUPERADMIN harus mengatur `cycle_start_date` melalui dashboard:
- URL: `/dashboard/settings/cycle`
- Atau via API: `POST /api/v1/duty/cycle-start-date`

---

## Format File Roster

Buat file JSON dengan format berikut (lihat contoh: `scripts/roster-data.json.example`):

```json
[
  { "name": "Nama Anggota 1", "organization_type": "OSIS", "week": "WEEK_1", "day": "MONDAY" },
  { "name": "Nama Anggota 2", "organization_type": "MPK", "week": "WEEK_1", "day": "TUESDAY" },
  ...
]
```

### Field yang didukung:

| Field  | Tipe   | Keterangan |
|--------|--------|------------|
| `nis`  | string | NIS anggota — opsional, diprioritaskan bila tersedia. |
| `name` | string | Nama lengkap anggota — wajib jika NIS tidak ada. Pencocokan **case-insensitive, exact match** setelah normalisasi. |
| `db_name` | string | Opsional. Nama persis di database bila ejaan pada daftar berbeda (mis. `Reza Maulana Dhabit` → `db_name: "Reza Maulana Dhabith"`). Tidak pernah menebak; harus ditulis eksplisit. |
| `class_grade` | string | Opsional. Dipakai untuk memilih bila ada anggota bernama sama, dan untuk laporan hasil impor. |
| `organization_type` | string | `OSIS` atau `MPK`; gunakan untuk menghindari anggota dengan nama sama dari organisasi berbeda. |
| `week` | string | `WEEK_1` atau `WEEK_2` |
| `day`  | string | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |

> [!IMPORTANT]
> Minimal salah satu dari `nis` atau `name` wajib ada. Script **tidak melakukan fuzzy matching** — jika tidak ada yang cocok, entri dilaporkan sebagai `UNMATCHED` dan dilewati. Normalisasi hanya menghapus karakter tak terlihat, spasi ganda, dan menyamakan apostrof; ejaan nama tetap harus sama.

---

## Cara Menjalankan

### Simulasi (dry-run) — tidak ada perubahan tersimpan:

```powershell
npx tsx scripts/import-roster.ts --input scripts/roster-data.json --dry-run
```

### Import live:

```powershell
npx tsx scripts/import-roster.ts --input scripts/roster-data.json
```

### Import untuk Danusan:

```powershell
npx tsx scripts/import-roster.ts --input scripts/roster-danusan.json --activity DANUSAN
```

### Opsi yang tersedia:

| Opsi | Default | Keterangan |
|------|---------|-----------|
| `--input <path>` | `scripts/roster-data.json` | Path file JSON roster |
| `--activity <code>` | `SAPA_PAGI` | Kode aktivitas di database |
| `--dry-run` | (tidak aktif) | Simulasi tanpa menyimpan ke database |
| `--create-schedules` | (tidak aktif) | Membuat `DutySchedule` yang belum ada untuk kombinasi minggu/hari pada file |
| `--start <HH:MM>` | `05:30` | Jam mulai untuk jadwal yang baru dibuat |
| `--cutoff <HH:MM>` | `06:00` | Cutoff untuk jadwal yang baru dibuat |
| `--replace` | (tidak aktif) | Menghapus roster lama **hanya pada jadwal yang dipakai file**, lalu mengisi ulang. Dibatalkan otomatis bila masih ada entri yang tidak cocok. |

### Roster Danusan 2026

Data terbaru tersimpan di `scripts/roster-danusan-2026.json` (69 penugasan: Minggu 1 dan 2, Senin–Jumat; Jumat Minggu 2 berisi 6 orang). Delapan nama pada daftar sumber memiliki ejaan berbeda dengan database dan sudah dipetakan eksplisit lewat `db_name`.

**Offset minggu Danusan:** Danusan memakai rotasi minggu yang berbeda dari siklus global. Offset disimpan di `SystemSetting` `activity_week_offset:DANUSAN = 1`, artinya saat siklus global `WEEK_1` jadwal Danusan yang aktif adalah `WEEK_2` (dan sebaliknya), sementara Sapa Pagi tetap mengikuti siklus global. Scan RFID, dashboard, dan prefill input manual sudah menghormati offset ini.

```powershell
# Lihat minggu efektif semua kegiatan hari ini
npm run set:week-offset -- --list

# Set Danusan memakai minggu kebalikan siklus global
npm run set:week-offset -- --activity DANUSAN --offset 1
```

```powershell
# Simulasi
npm run import:danusan -- --dry-run

# Impor (idempoten)
npm run import:danusan

# Ganti total roster Danusan pada 10 jadwal tersebut
npm run import:danusan -- --replace
```

10 jadwal `DutySchedule` Danusan (Minggu 1/2 × Senin–Jumat) sudah ada di database dengan jam `05:30–06:00` WIB. Script **tidak mengubah jam** jadwal yang sudah ada; gunakan `--create-schedules --start … --cutoff …` hanya bila ada jadwal yang benar-benar belum dibuat.

---

## Memahami Output

Script akan mencetak laporan ke konsol:

```
Total entri diproses : 25
Anggota ditemukan    : 23
Berhasil diinsert    : 23
Duplikat dilewati    : 0
Jadwal tidak ada     : 0
Format tidak valid   : 0
Anggota tidak cocok  : 2

DAFTAR ANGGOTA TIDAK DITEMUKAN:
  - Baris 12: NIS="999999" Name="Andi Firmansyah"
  - Baris 20: NIS="-" Name="Rini Suryani"
```

**Tindakan untuk anggota tidak cocok:**
1. Periksa NIS di database (Prisma Studio atau endpoint `GET /api/v1/members`).
2. Perbaiki nilai `nis` atau `name` di file JSON.
3. Jalankan ulang script — script bersifat **idempoten** (aman dijalankan berkali-kali).

---

## Keamanan & Batasan

- Script **tidak membuat anggota baru** dan **tidak menebak identitas**.
- Script bersifat idempoten: entri duplikat pada roster dilewati tanpa error.
- Script memerlukan koneksi database Railway (via `DATABASE_URL`).
- Pastikan variabel `DATABASE_URL` tersedia di environment lokal sebelum menjalankan script.

---

## Status Roster Saat Ini

> [!NOTE]
> Pada 13 November 2026, roster **Danusan 2026** (69 penugasan) diimpor ke database: Minggu 1 dan 2, Senin–Jumat, 7 orang per hari kecuali Jumat Minggu 2 (6 orang). Seluruh 69 entri cocok dengan 74 anggota yang ada; 8 di antaranya memakai `db_name` karena ejaan berbeda dengan database. Jam jadwal Danusan yang sudah ada adalah `05:30–06:00` WIB dan tidak diubah oleh proses impor. Kolom kelas anggota di database belum terisi, sehingga `class_grade` pada file baru dipakai untuk verifikasi.

> [!WARNING]
> Pada 8 November 2026, Railway telah berisi 74 anggota dari roster yang diberikan, 10 jadwal Sapa Pagi, dan 74 penugasan roster. Tanggal mulai siklus adalah 2026-11-09. UID RFID belum tersedia pada daftar nama dan belum ditautkan; absensi RFID baru dapat dipakai setelah setiap UID kartu dicatat pada anggota yang benar.
