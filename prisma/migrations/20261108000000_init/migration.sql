-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "AdminScope" AS ENUM ('GENERAL', 'SECRETARY', 'DISCIPLINE_4P', 'TREASURER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ALUMNI');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('OSIS', 'MPK', 'GENERAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ROUTINE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('RFID', 'MANUAL');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "admin_scope" "AdminScope",
    "member_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "nis" TEXT NOT NULL,
    "nisn" TEXT,
    "full_name" TEXT NOT NULL,
    "class_grade" TEXT NOT NULL,
    "organization_type" "OrganizationType" NOT NULL,
    "rfid_uid" TEXT,
    "photo_url" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "organization_type" "OrganizationType" NOT NULL DEFAULT 'GENERAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_positions" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "sekbid_id" TEXT,
    "commission_id" TEXT,
    "period_year" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_positions_pkey" PRIMARY KEY ("id")
);

-- Custom Check Constraint: Member position scope mutual exclusion
-- Ensures a position cannot be simultaneously assigned to both a Sekbid (OSIS) and a Commission (MPK)
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_scope_check" CHECK (NOT ("sekbid_id" IS NOT NULL AND "commission_id" IS NOT NULL));


-- CreateTable
CREATE TABLE "sekbids" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sekbids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL DEFAULT 'ROUTINE',
    "description" TEXT,
    "default_late_threshold_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_schedules" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "device_id" TEXT,
    "title" TEXT,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "late_threshold" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "scan_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL,
    "method" "AttendanceMethod" NOT NULL DEFAULT 'RFID',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sanction" TEXT,
    "status" "ViolationStatus" NOT NULL DEFAULT 'PENDING',
    "reported_by" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "last_seen" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_member_id_key" ON "users"("member_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "members_nis_key" ON "members"("nis");

-- CreateIndex
CREATE UNIQUE INDEX "members_rfid_uid_key" ON "members"("rfid_uid");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX "members_organization_type_idx" ON "members"("organization_type");

-- CreateIndex
CREATE INDEX "members_class_grade_idx" ON "members"("class_grade");

-- CreateIndex
CREATE INDEX "members_rfid_uid_idx" ON "members"("rfid_uid");

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE INDEX "member_positions_period_year_idx" ON "member_positions"("period_year");

-- CreateIndex
CREATE INDEX "member_positions_is_active_idx" ON "member_positions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "member_positions_member_id_position_id_period_year_key" ON "member_positions"("member_id", "position_id", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "sekbids_number_key" ON "sekbids"("number");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_code_key" ON "commissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "activities_code_key" ON "activities"("code");

-- CreateIndex
CREATE INDEX "activities_is_active_idx" ON "activities"("is_active");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activity_schedules_date_idx" ON "activity_schedules"("date");

-- CreateIndex
CREATE INDEX "activity_schedules_status_idx" ON "activity_schedules"("status");

-- CreateIndex
CREATE INDEX "activity_schedules_activity_id_date_idx" ON "activity_schedules"("activity_id", "date");

-- CreateIndex
CREATE INDEX "attendances_schedule_id_status_idx" ON "attendances"("schedule_id", "status");

-- CreateIndex
CREATE INDEX "attendances_member_id_status_idx" ON "attendances"("member_id", "status");

-- CreateIndex
CREATE INDEX "attendances_scan_time_idx" ON "attendances"("scan_time");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_member_id_schedule_id_key" ON "attendances"("member_id", "schedule_id");

-- CreateIndex
CREATE INDEX "violations_member_id_status_idx" ON "violations"("member_id", "status");

-- CreateIndex
CREATE INDEX "violations_date_idx" ON "violations"("date");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_code_key" ON "devices"("device_code");

-- CreateIndex
CREATE INDEX "devices_is_active_idx" ON "devices"("is_active");

-- CreateIndex
CREATE INDEX "devices_device_code_idx" ON "devices"("device_code");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_sekbid_id_fkey" FOREIGN KEY ("sekbid_id") REFERENCES "sekbids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_schedules" ADD CONSTRAINT "activity_schedules_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_schedules" ADD CONSTRAINT "activity_schedules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "activity_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

