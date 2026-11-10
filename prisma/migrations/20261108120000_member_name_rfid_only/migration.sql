-- NIS and class are optional for attendance registration. Existing values remain intact.
ALTER TABLE "members" ALTER COLUMN "nis" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "class_grade" DROP NOT NULL;
