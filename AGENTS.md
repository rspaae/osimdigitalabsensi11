# AGENTS.md — Development Guidelines & Foundation Rules

## Project Overview
- **Project:** OSIS MPK SMKN 11 BANDUNG
- **Application:** OSIS MPK Attendance & Management System
- **Stack:** Next.js (App Router), TypeScript (Strict), Tailwind CSS, shadcn/ui, PostgreSQL, Prisma, Zod.

---

## Core Development Rules

### 1. Architecture & Modularity
- **Modular Architecture:** Pisahkan dengan jelas tanggung jawab layer:
  - `UI / Components`: Presentational dan client components.
  - `Business Logic`: Domain logic, services, dan business calculations.
  - `Database`: Prisma schema, migrations, queries, dan repository layer.
  - `Validation`: Skema Zod untuk validasi input dan output.
  - `API / Server Actions`: Next.js Route Handlers dan Server Actions.
- **Server-side Security:**
  - Wajib menerapkan server-side validation dan authorization di setiap endpoint atau Server Action.
  - Jangan pernah menyimpan secret, token sensitif, service key, atau credential di client-side/frontend code.
- **No Architectural Drift:** Jangan melakukan perubahan arsitektur besar tanpa persetujuan eksplisit.

### 2. Role-Based Access Control (RBAC)
Sistem menggunakan 4 role utama:
1. `SUPERADMIN` — Kontrol penuh atas konfigurasi sistem, audit log, pengguna, dan data master.
2. `ADMIN` — Pengelolaan harian kegiatan absensi, verifikasi, koreksi, dan rekapitulasi data.
3. `ANGGOTA` — Melihat riwayat absensi pribadi, profil, dan informasi kegiatan.
4. `VIEWER` — Akses read-only untuk pemantauan/monitoring.

### 3. Business Logic & Attendance Rules
- **Aktivitas Absensi:**
  - Sapa Pagi
  - Danusan (Dana Usaha)
  - Nyisir 4P (Patroli Pagi/Peduli Pelanggaran & Penertiban)
- **Data Integrity:**
  - Satu anggota hanya boleh memiliki **satu record absensi** untuk satu sesi kegiatan (unique constraint per member per session).
  - Setiap koreksi atau manipulasi status absensi wajib memiliki **audit log** tercatat (siapa yang mengubah, kapan, status sebelumnya, status baru, dan alasan perubahan).

### 4. IoT & Hardware Integration
- **Hardware Stack:** ESP32 DevKit V1 dan RFID Reader RC522.
- **Communication Protocol:** REST API via HTTPS terenkripsi dengan autentikasi berbasis device API Key / Token aman.

### 5. Design & User Interface Standards
- **Color Palette:**
  - Mint Green (Aksen utama / Segar)
  - Cream (Background warm / Elemen kontras lembut)
  - White (Card background, kontras bersih)
- **UI Principles:**
  - Profesional, minimalis, konsisten, responsif (mobile-friendly), dan mudah digunakan oleh siswa maupun pengurus.
- **No AI Slop / Fake Code Policy:**
  - Hindari dekorasi berlebihan dan efek gradient yang tidak perlu.
  - Dilarang membuat fake charts, fake statistics, dummy functionality, dead buttons, atau placeholder yang diklaim sebagai fitur nyata.
  - Setiap fitur harus benar-benar berfungsi secara end-to-end sebelum dinyatakan selesai.

### 6. Code Quality & Engineering Discipline
- **TypeScript Strictness:**
  - `strict: true` harus selalu dipatuhi.
  - Dilarang keras menggunakan tipe `any` tanpa alasan teknis yang sangat mendesak dan didokumentasikan.
- **Code Preservation:**
  - Jangan menghapus, memodifikasi sembarangan, atau menimpa kode yang sudah berfungsi tanpa pemeriksaan mendalam.
- **Verification Gates:**
  - Setiap implementasi kode harus lolos pengujian TypeScript (`tsc`), linting (`eslint`), dan build check (`next build`).
  - Laporkan setiap hasil pengujian dan audit secara jujur dan transparan tanpa menyembunyikan warning atau error.

---

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
