# Deploy ke Vercel

## Pra-syarat

- Deploy dari root repository; framework `Next.js`, build command `npm run build`.
- Railway production sudah menjalankan seluruh migrasi Prisma. Verifikasi dengan `npx prisma migrate status` sebelum deploy; jangan menjalankan `migrate dev` terhadap Railway production.
- Jangan commit `.env`, `.vercel`, atau `iot/esp32-attendance/secrets.h`.

## Environment Variables

Tambahkan hanya di Vercel **Project → Settings → Environment Variables**:

| Nama | Nilai |
|---|---|
| `DATABASE_URL` | URL koneksi Railway PostgreSQL yang dapat diakses dari internet. Gunakan nilai dari konfigurasi lokal; jangan menyalin ke source code atau variabel `NEXT_PUBLIC_*`. |
| `AUTH_SECRET` | Secret produksi baru minimal 32 karakter. Buat dan simpan langsung di password manager/Vercel; jangan kirim lewat chat atau commit. |

Pilih environment **Production**. Jangan hubungkan Preview ke Railway production; gunakan database staging terpisah jika Preview perlu dipakai.

`INITIAL_SUPERADMIN_SECRET` tidak diperlukan untuk deploy ini karena akun Superadmin sudah ada. Jangan jalankan endpoint/script inisialisasi lagi kecuali memang sedang menyiapkan database kosong.

Vercel menjalankan `prisma generate` melalui script `postinstall`. `npm run build` adalah build command; migrasi database tidak dijalankan otomatis saat build.

## Langkah Deploy

1. Tautkan repository ke Vercel atau jalankan `npx vercel link` dari root proyek.
2. Isi environment variables di atas pada environment Production.
3. Jalankan deploy Production.
4. Setelah deploy, buka `/api/health`; respons harus menunjukkan `status: healthy` dan database `connected`.
5. Buka `/login` dan pastikan login Superadmin berfungsi.
6. Gunakan origin HTTPS hasil deploy sebagai `SERVER_BASE_URL` di firmware ESP32. Jangan gunakan `localhost`.

## Sebelum Scan RFID

- Daftarkan ESP32 dari **Dashboard → Perangkat IoT**. API key hanya tampil satu kali; simpan lokal di `iot/esp32-attendance/secrets.h` yang diabaikan Git.
- Isi Wi-Fi, URL hasil deploy, device code, API key, dan sertifikat Root CA Vercel di `secrets.h`.
- Isi UID kartu sebenarnya pada anggota melalui **Dashboard → Data Anggota**.
- Kompilasi dan upload firmware, lalu uji kartu menggunakan jadwal aktif. Build website saja tidak memverifikasi perangkat keras.
