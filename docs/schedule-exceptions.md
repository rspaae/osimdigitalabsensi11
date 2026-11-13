# Kalender Libur (Pengecualian Jadwal)

## Ringkasan

Sebagian hari, piket **Sapa Pagi** dan/atau **Danusan** ditiadakan (libur nasional, kegiatan sekolah, kondisi mendadak). Sistem menyimpan pengecualian **per tanggal** di tabel `schedule_exceptions`, bukan dengan mengubah `DutySchedule` mingguan — supaya rotasi minggu berikutnya tidak rusak.

- `activity_id` **NULL** → semua kegiatan libur pada tanggal tersebut.
- `activity_id` terisi → hanya kegiatan itu yang libur.

## Perilaku

| Area | Perilaku |
|---|---|
| Scan RFID | Jadwal yang libur dikeluarkan dari pencocokan. Bila anggota hanya bertugas di kegiatan yang libur (atau semua kegiatan libur), server menolak dengan kode `ACTIVITY_CANCELLED` dan **tidak membuat record absensi**. LCD menampilkan `KEGIATAN LIBUR / Tidak Ada Piket`. |
| Dashboard | Kartu jadwal yang libur tidak ditampilkan sebagai tagihan; muncul pemberitahuan “Piket diliburkan hari ini” beserta alasannya. Statistik “petugas hari ini/belum absen” tidak menghitung kegiatan yang libur. |
| Input manual | Pembuatan sesi baru untuk kegiatan yang libur ditolak (API `POST /api/v1/schedules` mengembalikan `ACTIVITY_CANCELLED`). Halaman input manual menampilkan keterangan libur dan menyembunyikan kegiatan tersebut dari pilihan. |
| Laporan | Karena tidak ada sesi/record yang dibuat saat libur, jumlah sesi pada laporan tidak bertambah dan persentase kehadiran tetap akurat. |
| Audit | Setiap penambahan/penghapusan pengecualian dicatat ke `AuditLog` (aksi `CREATE`/`UPDATE`/`DELETE`, entitas `ScheduleException`). |

## Model data

```prisma
model ScheduleException {
  id          String   @id @default(uuid())
  date        DateTime @db.Date
  activity_id String?  // NULL = semua kegiatan
  reason      String
  created_by  String
  created_at  DateTime @default(now())
  activity    Activity? @relation(...)
  creator     User      @relation(...)

  @@unique([date, activity_id])
  @@index([date])
  @@map("schedule_exceptions")
}
```

Migrasi juga menambahkan indeks unik parsial agar hanya ada satu pengecualian “semua kegiatan” per tanggal:

```sql
CREATE UNIQUE INDEX "schedule_exceptions_date_all_key"
  ON "schedule_exceptions"("date") WHERE "activity_id" IS NULL;
```

## Halaman pengelolaan

`/dashboard/settings/exceptions` (SUPERADMIN, menu **Kalender libur**):

- Tambah satu tanggal atau rentang tanggal (maksimal 366 hari per aksi).
- Pilih kegiatan tertentu atau “Semua kegiatan”.
- Alasan wajib (5–200 karakter).
- Daftar pengecualian 30 hari terakhir s.d. 120 hari ke depan, lengkap dengan tombol hapus.

Mengulang tanggal+kegiatan yang sama akan memperbarui alasannya (idempoten).

## API

| Metode | Endpoint | Izin | Keterangan |
|---|---|---|---|
| `GET` | `/api/v1/schedule-exceptions?from=&to=` | `SYSTEM_SETTINGS.READ` | Daftar pengecualian |
| `POST` | `/api/v1/schedule-exceptions` | `SYSTEM_SETTINGS.UPDATE` | Body: `{ date, end_date?, activity_id?, reason }` |
| `DELETE` | `/api/v1/schedule-exceptions/[id]` | `SYSTEM_SETTINGS.UPDATE` | Batalkan status libur |

## Firmware

Kedua sketch (`iot/esp32-attendance` dan `iot/esp32-attendance-single`) sudah memetakan kode error baru:

```cpp
else if (codeStr == "ACTIVITY_CANCELLED") displayLcd("KEGIATAN LIBUR", "Tidak Ada Piket");
```

## Batasan Fase 1

- Sesi yang **sudah terbentuk sebelum** tanggal ditandai libur belum dibatalkan otomatis. Untuk kondisi mendadak, tandai libur **sebelum** jendela piket dimulai.
- Pengecualian tidak berulang (mis. setiap Jumat libur); tambahkan per tanggal/rentang.
- Pembatalan sesi yang sudah ada (status `CANCELLED` + pengecualian dari laporan) direncanakan pada Fase 2.
