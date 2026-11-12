-- AlterTable: pelacakan scan ulang pada record absensi
ALTER TABLE "attendances" ADD COLUMN     "auto_upgraded_at" TIMESTAMP(3),
ADD COLUMN     "last_scan_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scan_count" INTEGER NOT NULL DEFAULT 1;

-- Backfill: untuk record lama, scan terakhir dianggap sama dengan waktu scan pertama
UPDATE "attendances" SET "last_scan_at" = "scan_time";
