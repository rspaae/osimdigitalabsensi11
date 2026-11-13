-- Pengecualian jadwal per tanggal (libur / kegiatan ditiadakan)
CREATE TABLE "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "activity_id" TEXT,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- Satu pengecualian per tanggal+kegiatan
CREATE UNIQUE INDEX "schedule_exceptions_date_activity_id_key"
    ON "schedule_exceptions"("date", "activity_id");

-- Satu pengecualian "semua kegiatan" per tanggal (activity_id NULL)
CREATE UNIQUE INDEX "schedule_exceptions_date_all_key"
    ON "schedule_exceptions"("date")
    WHERE "activity_id" IS NULL;

CREATE INDEX "schedule_exceptions_date_idx" ON "schedule_exceptions"("date");

ALTER TABLE "schedule_exceptions"
    ADD CONSTRAINT "schedule_exceptions_activity_id_fkey"
    FOREIGN KEY ("activity_id") REFERENCES "activities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_exceptions"
    ADD CONSTRAINT "schedule_exceptions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
