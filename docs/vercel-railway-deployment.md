# PANDUAN DEPLOYMENT VERCEL & RAILWAY POSTGRESQL

Dokumentasi arsitektur cloud dan petunjuk deployment produksi untuk Sistem Presensi & Manajemen OSIS MPK SMKN 11 BANDUNG.

---

## 1. Topologi Arsitektur Cloud

- **Frontend & API Layer:** Vercel (Next.js 16 App Router, Node.js Serverless Functions)
- **Database Layer:** Railway Managed PostgreSQL 18.6
- **Edge Security & Routing:** Vercel Edge Middleware (`proxy.ts`)
- **IoT Ingestion:** Direct HTTPS ke Vercel Serverless Function via `/api/v1/attendance/scan`

---

## 2. Kebutuhan Environment Variables

Pastikan variabel berikut telah dikonfigurasi di Vercel Dashboard (**Project Settings → Environment Variables**):

| Nama Variabel | Lingkungan | Deskripsi & Contoh Nilai |
|---|---|---|
| `DATABASE_URL` | Production & Preview | URL koneksi Railway PostgreSQL dengan SSL aktif: `postgresql://postgres:password@autorack.railway.app:5432/railway?schema=public&sslmode=require` |
| `AUTH_SECRET` | Production & Preview | Kunci acak minimal 32 karakter untuk enkripsi HS256 JWT cookie: `openssl rand -hex 32` |
| `INITIAL_SUPERADMIN_SECRET` | Production | Token rahasia sekali pakai untuk onboarding Superadmin via `/api/auth/setup-superadmin` |
| `NODE_ENV` | Production | `production` (otomatis diset oleh Vercel) |

> [!CAUTION]
> Jangan pernah mengaktifkan `NEXT_PUBLIC_` prefix pada `DATABASE_URL` atau `AUTH_SECRET`. Seluruh database access harus berada pada server side.

---

## 3. Konfigurasi Koneksi Serverless & Connection Pooling

Vercel menggunakan arsitektur serverless di mana fungsi dijalankan sesuai permintaan (spin-up on demand).

1. **Prisma Client Singleton:**
   File `lib/db/prisma.ts` telah mengimplementasikan pencegahan instance ganda selama hot-reload dan caching koneksi:
   ```typescript
   export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... });
   ```
2. **Batas Koneksi Railway:**
   Railway PostgreSQL Starter/Pro memiliki kuota koneksi bersamaan (`max_connections` default 100).
   Untuk mencegah exhaust koneksi:
   - Tambahkan parameter pool size di `DATABASE_URL`:
     `...?connection_limit=10&pool_timeout=20`
   - Atau aktifkan PgBouncer di Railway jika trafik meningkat drastis.

---

## 4. Konfigurasi Build & Output Vercel

Pengaturan build default pada `package.json` dan `next.config.ts`:

- **Framework Preset:** Next.js
- **Build Command:** `next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Prisma Client Generation:** Otomatis dijalankan sebelum build melalui postinstall script:
  ```json
  "scripts": {
    "postinstall": "prisma generate"
  }
  ```

---

## 5. Prosedur Deployment Langkah-demi-Langkah

### Tahap 1 — Persiapan Database (Railway)
1. Buat project baru di Railway dan pilih modul **PostgreSQL**.
2. Salin connection string dari tab **Connect** (Gunakan Public Connection URL jika Vercel berada di luar Railway network).
3. Jalankan migrasi Prisma dari workstation pengembang atau CI/CD:
   ```bash
   npx prisma migrate deploy
   ```
4. Pastikan tabel `users`, `members`, `devices`, `attendances`, dll. terbuat dengan benar.

### Tahap 2 — Konfigurasi Vercel
1. Import repositori GitHub ke akun Vercel tim SMKN 11 Bandung.
2. Masukkan seluruh environment variable (`DATABASE_URL`, `AUTH_SECRET`, `INITIAL_SUPERADMIN_SECRET`).
3. Deploy branch `main`.

### Tahap 3 — Inisialisasi Akun Superadmin
1. Setelah deployment Vercel berstatus **Ready**, jalankan inisialisasi akun Superadmin perdana:
   ```bash
   curl -X POST https://your-app.vercel.app/api/auth/setup-superadmin \
     -H "Content-Type: application/json" \
     -d '{
       "setup_secret": "<INITIAL_SUPERADMIN_SECRET>",
       "username": "superadmin",
       "email": "superadmin@smkn11bdg.sch.id",
       "password": "<STRONG_PASSWORD_MIN_8_CHARS>"
     }'
   ```
2. Endpoint ini otomatis terkunci dan tidak dapat dijalankan ulang jika akun Superadmin sudah terbentuk.

### Tahap 4 — Registrasi Perangkat IoT
1. Login ke aplikasi sebagai Superadmin.
2. Daftarkan perangkat ESP32 via API `/api/v1/devices`.
3. Salin `raw_api_key` ke file `secrets.h` pada firmware perangkat.

---

## 6. Monitoring & Health Check

Endpoint pemantauan kesehatan publik:
- **URL:** `GET /api/health`
- **Tingkat Akses:** Publik (tidak perlu login)
- **Format Respon:**
  ```json
  {
    "status": "healthy",
    "application": "OSIS MPK Attendance & Management System",
    "timestamp": "2026-11-08T09:00:00.000Z",
    "database": {
      "status": "connected",
      "latencyMs": 18
    }
  }
  ```
Jika database Railway tidak terhubung, endpoint mengembalikan HTTP 503 dengan `status: "degraded"` tanpa menampilkan username atau password basis data.

---

## 7. Prosedur Rollback & Rencana Kontinjensi

Jika terjadi regresi kode atau kegagalan kritis setelah rilis:
1. **Instant Rollback Vercel:**
   - Buka Vercel Dashboard → **Deployments**.
   - Cari deployment stabil sebelumnya.
   - Klik menu titik tiga (...) → pilih **Instant Rollback**.
   - Trafik publik akan dialihkan seketika (< 5 detik) ke versi sebelumnya tanpa perlu rebuild.
2. **Rollback Database (Jika Perlu):**
   - Skema database dipertahankan backward-compatible (non-destructive).
   - Jangan menjalankan `prisma migrate reset` pada database Railway produksi karena akan menghapus seluruh data historis presensi.
   - Jika terdapat migrasi skema yang salah, buat migrasi korektif baru (`npx prisma migrate diff`).

---

## 8. Pre-Flight Security & Deployment Checklist

- [x] Tidak ada berkas kredensial (`.env`, `secrets.h`, `*.pem`) yang ter-commit ke Git.
- [x] Kunci `AUTH_SECRET` memiliki panjang minimal 32 karakter acak.
- [x] Kredensial database hanya tersimpan pada server environment Vercel.
- [x] Endpoint pemindaian IoT (`/api/v1/attendance/scan`) terlindungi oleh autentikasi device API key.
- [x] Endpoint administratif (`/api/v1/members`, `/api/v1/devices`, `/api/v1/schedules`) dilindungi otentikasi sesi cookie & RBAC.
- [x] Raw API key perangkat tidak pernah disimpan dalam log sistem.
- [x] Endpoint `/api/health` tidak mengekspos credential basis data.
