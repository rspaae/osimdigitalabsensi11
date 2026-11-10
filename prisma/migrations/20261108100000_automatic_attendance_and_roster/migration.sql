-- CreateEnum
CREATE TYPE "CycleWeek" AS ENUM ('WEEK_1', 'WEEK_2');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('APPROVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'DI_LUAR_JADWAL';

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "duty_schedule_id" TEXT,
ADD COLUMN     "is_substitution" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "duty_schedules" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "cycle_week" "CycleWeek" NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "start_time_wib" TEXT NOT NULL,
    "cutoff_time_wib" TEXT NOT NULL,
    "title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_roster_members" (
    "id" TEXT NOT NULL,
    "duty_schedule_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_roster_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_substitutions" (
    "id" TEXT NOT NULL,
    "duty_schedule_id" TEXT NOT NULL,
    "duty_date" DATE NOT NULL,
    "original_member_id" TEXT NOT NULL,
    "substitute_member_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'APPROVED',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duty_schedules_cycle_week_day_of_week_idx" ON "duty_schedules"("cycle_week", "day_of_week");

-- CreateIndex
CREATE INDEX "duty_schedules_is_active_idx" ON "duty_schedules"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "duty_schedules_activity_id_cycle_week_day_of_week_key" ON "duty_schedules"("activity_id", "cycle_week", "day_of_week");

-- CreateIndex
CREATE INDEX "duty_roster_members_duty_schedule_id_idx" ON "duty_roster_members"("duty_schedule_id");

-- CreateIndex
CREATE INDEX "duty_roster_members_member_id_idx" ON "duty_roster_members"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "duty_roster_members_duty_schedule_id_member_id_key" ON "duty_roster_members"("duty_schedule_id", "member_id");

-- CreateIndex
CREATE INDEX "duty_substitutions_duty_date_idx" ON "duty_substitutions"("duty_date");

-- CreateIndex
CREATE INDEX "duty_substitutions_duty_schedule_id_duty_date_idx" ON "duty_substitutions"("duty_schedule_id", "duty_date");

-- CreateIndex
CREATE INDEX "duty_substitutions_original_member_id_duty_date_idx" ON "duty_substitutions"("original_member_id", "duty_date");

-- CreateIndex
CREATE INDEX "duty_substitutions_substitute_member_id_duty_date_idx" ON "duty_substitutions"("substitute_member_id", "duty_date");

-- CreateIndex
CREATE INDEX "attendances_duty_schedule_id_idx" ON "attendances"("duty_schedule_id");

-- AddForeignKey
ALTER TABLE "duty_schedules" ADD CONSTRAINT "duty_schedules_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_roster_members" ADD CONSTRAINT "duty_roster_members_duty_schedule_id_fkey" FOREIGN KEY ("duty_schedule_id") REFERENCES "duty_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_roster_members" ADD CONSTRAINT "duty_roster_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_substitutions" ADD CONSTRAINT "duty_substitutions_duty_schedule_id_fkey" FOREIGN KEY ("duty_schedule_id") REFERENCES "duty_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_substitutions" ADD CONSTRAINT "duty_substitutions_original_member_id_fkey" FOREIGN KEY ("original_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_substitutions" ADD CONSTRAINT "duty_substitutions_substitute_member_id_fkey" FOREIGN KEY ("substitute_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_substitutions" ADD CONSTRAINT "duty_substitutions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
